import threading
import time
import cv2
import logging
import asyncio
import os
import uuid
from datetime import datetime, timezone
from app.vision.detector import get_detector
from app.vision.adapter import ModelAdapter
from app.vision.tracker import SimpleTracker
from app.vision.preprocessing import FrameSampler, resize_frame, frame_to_base64
from app.safety.ppe_rules import PPERuleEngine, PPEStatus
from app.safety.zone_rules import ZoneRuleEngine
from app.safety.risk_scoring import calculate_risk_score
from app.db.database import SessionLocal
from app.db.models import MonitoringSession, Zone
from app.services.incident_service import IncidentService
from app.api.websocket import manager as ws_manager

logger = logging.getLogger(__name__)

class VideoProcessor:
    def __init__(self, session_id: int, source: str, camera_id: int, settings, db_factory):
        self.session_id = session_id
        self.source = source
        self.camera_id = camera_id
        self.settings = settings
        self.db_factory = db_factory
        self.running = False
        
        self.detector = get_detector(
            repo_id=settings.model_repo_id,
            revision=settings.model_revision,
            person_conf=settings.person_confidence,
            ppe_conf=settings.ppe_confidence
        )
        self.adapter = ModelAdapter(self.detector)
        self.tracker = SimpleTracker()
        self.ppe_engine = PPERuleEngine(settings)
        self.zone_engine = ZoneRuleEngine()
        self.frame_sampler = FrameSampler(target_fps=settings.frame_sample_fps)
        self.metrics = {"fps": 0.0, "latency_ms": 0.0, "frames_processed": 0, "detections": 0}
        self.zones = []
        
        self.required_ppe = ["helmet", "vest"]
        self.camera_organization_id = None
        
        # Load zones and camera safety profile
        db = self.db_factory()
        try:
            from app.db.models import Camera, SafetyProfile
            cam = db.query(Camera).filter(Camera.id == self.camera_id).first()
            if cam:
                self.camera_organization_id = cam.organization_id
                if cam.safety_profile:
                    self.required_ppe = cam.safety_profile.required_ppe or ["helmet", "vest"]
                else:
                    # Check if organization has a default profile
                    default_profile = db.query(SafetyProfile).filter(
                        SafetyProfile.organization_id == cam.organization_id,
                        SafetyProfile.is_default == True
                    ).first()
                    if default_profile and default_profile.required_ppe:
                        self.required_ppe = default_profile.required_ppe

            zone_records = db.query(Zone).filter(Zone.camera_id == self.camera_id).all()
            self.zones = [
                {
                    "id": z.id,
                    "name": z.name,
                    "polygon_json": z.polygon_json,
                    "is_restricted": z.is_restricted,
                    "severity": z.severity
                }
                for z in zone_records
            ]
        finally:
            db.close()
        logger.info(f"Session {self.session_id} active required PPE policy: {self.required_ppe}")

    def start(self):
        self.running = True
        thread = threading.Thread(target=self._process_loop, daemon=True)
        thread.start()
        logger.info(f"Started video processor thread for session {self.session_id} from source: {self.source}")
        
    def _parse_source(self, src: str):
        # Support string integers for webcam device indices
        if isinstance(src, str):
            src_clean = src.strip().lower()
            if src_clean in ["0", "webcam", "webcam 0", "webcam0", "default"]:
                return 0
            if src_clean.isdigit():
                return int(src_clean)
        return src

    def _process_loop(self):
        video_src = self._parse_source(self.source)
        logger.info(f"Opening cv2.VideoCapture with source: {video_src}")
        
        # On Windows, try CAP_DSHOW if opening index 0 for fast webcam access
        if isinstance(video_src, int):
            cap = cv2.VideoCapture(video_src, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(video_src)
        else:
            cap = cv2.VideoCapture(video_src)

        if not cap.isOpened():
            logger.error(f"Failed to open video source {video_src} for session {self.session_id}")
            self.running = False
            self._update_session_status("error")
            return
            
        loop = getattr(SessionManager, 'main_loop', None)
        if loop is None or loop.is_closed():
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

        try:
            while self.running:
                ret, frame = cap.read()
                if not ret:
                    if isinstance(video_src, int):
                        # Webcam frame read glitch: retry slightly
                        time.sleep(0.05)
                        continue
                    else:
                        break
                    
                if not self.frame_sampler.should_process(target_fps=self.settings.frame_sample_fps):
                    time.sleep(0.01)
                    continue
                    
                start_time = time.time()
                frame = resize_frame(frame)
                h, w = frame.shape[:2]
                
                # Inference
                detections = self.adapter.predict(frame, required_ppe=self.required_ppe)
                self.metrics["detections"] += len(detections)
                
                # Tracking
                tracked_detections = self.tracker.update(detections)
                
                # Separate classes
                persons = self.adapter.get_persons(tracked_detections)
                ppe_items = self.adapter.get_ppe_items(tracked_detections)
                violations = self.adapter.get_violations(tracked_detections)
                
                # Evaluate PPE & Zones
                ppe_assessments = self.ppe_engine.evaluate(persons, ppe_items, violations, required_ppe=self.required_ppe)
                zone_violations = self.zone_engine.check_zone_entry(persons, self.zones, w, h, self.settings.violation_confirm_frames)
                
                # Process incidents & save evidence
                self._record_violations(ppe_assessments, zone_violations, frame)
                
                # Annotate
                annotated_frame = self.adapter.annotate_frame(frame, tracked_detections)
                
                # Metrics
                process_time_ms = (time.time() - start_time) * 1000
                self.metrics["latency_ms"] = round(process_time_ms, 1)
                self.metrics["frames_processed"] += 1
                self.metrics["fps"] = round(1000.0 / process_time_ms, 1) if process_time_ms > 0 else 0.0

                # Send live WebSocket frames & metrics
                try:
                    frame_b64 = frame_to_base64(annotated_frame)
                    event_payload = {
                        "type": "frame_update",
                        "session_id": self.session_id,
                        "frame_base64": frame_b64,
                        "detections": [
                            {
                                "class_name": d.class_name,
                                "confidence": round(d.confidence, 2),
                                "bbox": list(d.bbox),
                                "track_id": d.track_id
                            }
                            for d in tracked_detections
                        ],
                        "metrics": {
                            "fps": self.metrics["fps"],
                            "latency_ms": self.metrics["latency_ms"],
                            "frames_processed": self.metrics["frames_processed"],
                            "detections_count": self.metrics["detections"]
                        }
                    }
                    asyncio.run_coroutine_threadsafe(ws_manager.send_event(self.session_id, event_payload), loop)
                except Exception as ws_err:
                    logger.debug(f"WS send error: {ws_err}")

        except Exception as e:
            logger.error(f"Error in video processor loop for session {self.session_id}: {e}")
        finally:
            cap.release()
            self.running = False
            self._update_session_status("completed")
            logger.info(f"Video processor loop finished for session {self.session_id}")

    def _record_violations(self, ppe_assessments, zone_violations, frame):
        db = self.db_factory()
        try:
            # 1. Handle dynamic PPE assessments
            for assessment in ppe_assessments:
                if assessment.helmet_status == PPEStatus.VIOLATION:
                    self._create_or_update_incident(
                        db=db,
                        violation_type="missing_helmet",
                        confidence=assessment.confidence,
                        track_id=assessment.person_track_id,
                        frame=frame,
                        description=f"Person #{assessment.person_track_id} missing safety hardhat/helmet."
                    )
                if assessment.vest_status == PPEStatus.VIOLATION:
                    self._create_or_update_incident(
                        db=db,
                        violation_type="missing_vest",
                        confidence=assessment.confidence,
                        track_id=assessment.person_track_id,
                        frame=frame,
                        description=f"Person #{assessment.person_track_id} missing reflective safety vest."
                    )
                if assessment.item_statuses.get("mask") == PPEStatus.VIOLATION:
                    self._create_or_update_incident(
                        db=db,
                        violation_type="missing_mask",
                        confidence=assessment.confidence,
                        track_id=assessment.person_track_id,
                        frame=frame,
                        description=f"Person #{assessment.person_track_id} missing required sanitary face mask."
                    )
                if assessment.item_statuses.get("gloves") == PPEStatus.VIOLATION:
                    self._create_or_update_incident(
                        db=db,
                        violation_type="missing_gloves",
                        confidence=assessment.confidence,
                        track_id=assessment.person_track_id,
                        frame=frame,
                        description=f"Person #{assessment.person_track_id} in cleanroom missing required sterile protective gloves."
                    )
            
            # 2. Handle restricted zone violations
            for zv in zone_violations:
                self._create_or_update_incident(
                    db=db,
                    violation_type="restricted_zone",
                    confidence=0.9,
                    track_id=zv.get("track_id"),
                    frame=frame,
                    description=f"Unauthorized entry detected in restricted zone: {zv.get('zone_name')}"
                )
        except Exception as err:
            logger.error(f"Failed to record violations: {err}")
        finally:
            db.close()

    def _create_or_update_incident(self, db, violation_type: str, confidence: float, track_id: int, frame, description: str):
        score, severity = calculate_risk_score(violation_type, confidence, max_score=self.settings.max_risk_score)
        
        # Save snapshot
        os.makedirs(self.settings.evidence_dir, exist_ok=True)
        snapshot_filename = f"ev_{self.session_id}_{int(time.time())}_{uuid.uuid4().hex[:6]}.jpg"
        snapshot_path = os.path.join(self.settings.evidence_dir, snapshot_filename)
        cv2.imwrite(snapshot_path, frame)
        
        IncidentService.create_incident(
            db=db,
            camera_id=self.camera_id,
            session_id=self.session_id,
            violation_type=violation_type,
            risk_score=score,
            severity=severity,
            track_id=track_id,
            description=description,
            snapshot_path=snapshot_path,
            detection_data={"confidence": confidence, "track_id": track_id},
            organization_id=self.camera_organization_id
        )

    def _update_session_status(self, status: str):
        db = self.db_factory()
        try:
            sess = db.query(MonitoringSession).filter(MonitoringSession.id == self.session_id).first()
            if sess:
                sess.status = status
                sess.ended_at = datetime.now(timezone.utc)
                sess.avg_fps = self.metrics["fps"]
                sess.avg_latency_ms = self.metrics["latency_ms"]
                sess.frame_count = self.metrics["frames_processed"]
                sess.detection_count = self.metrics["detections"]
                db.commit()
        except Exception as e:
            logger.error(f"Failed to update session status: {e}")
        finally:
            db.close()

    def stop(self):
        self.running = False

    def get_metrics(self) -> dict:
        return self.metrics.copy()

class SessionManager:
    _processors: dict[int, VideoProcessor] = {}
    
    @classmethod
    def start_session(cls, session_id: int, source: str, camera_id: int, settings, db_factory) -> VideoProcessor:
        if session_id in cls._processors:
            cls._processors[session_id].stop()
            
        processor = VideoProcessor(session_id, source, camera_id, settings, db_factory)
        cls._processors[session_id] = processor
        processor.start()
        return processor
    
    @classmethod
    def stop_session(cls, session_id: int):
        if session_id in cls._processors:
            cls._processors[session_id].stop()
            del cls._processors[session_id]
            
    @classmethod
    def get_session(cls, session_id: int) -> VideoProcessor | None:
        return cls._processors.get(session_id)
