"""
AEGISBURN AI - FastAPI Router
Endpoints supporting full interactive workflow:
- Upload Training Dataset (/api/aegis-burn/datasets/training)
- Upload Testing Dataset (/api/aegis-burn/datasets/testing)
- Inspect Datasets & Preview (/api/aegis-burn/datasets/{id}/inspect)
- Schema Comparison (/api/aegis-burn/schema-comparison)
- Train & Benchmark Models (/api/aegis-burn/train-and-benchmark)
- Predict Testing Dataset (/api/aegis-burn/predict)
- Export Predictions (CSV / JSON) (/api/aegis-burn/export)
- Update Review Status (/api/aegis-burn/records/{row_id}/review)
- Analysis History (/api/aegis-burn/history)
- Generate Report (/api/aegis-burn/report)
"""

from __future__ import annotations
import os
import io
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional

import pandas as pd
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Response
from pydantic import BaseModel

from .ml_engine import (
    inspect_dataset_dataframe,
    compare_schemas,
    train_and_benchmark,
    predict_dataset
)

router = APIRouter(prefix="/api/aegis-burn", tags=["AEGISBURN AI Platform"])

STORAGE_DIR = Path(__file__).parent / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR = STORAGE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
HISTORY_FILE = STORAGE_DIR / "analysis_history.json"
MODELS_DIR = STORAGE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# In-memory session store
_ACTIVE_SESSION: Dict[str, Any] = {
    "analysis_id": "ANALYSIS #1042",
    "train_df": None,
    "test_df": None,
    "predictions_df": None,
    "train_meta": None,
    "test_meta": None,
    "pipeline": None,
    "benchmark": None,
    "prediction_summary": None,
    "review_decisions": {}, # row_index -> status
    "last_updated": datetime.now(timezone.utc).isoformat()
}


def load_history() -> List[Dict[str, Any]]:
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []


def save_history(entry: Dict[str, Any]):
    history = load_history()
    history.insert(0, entry)
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history[:30], f, indent=2)
    except Exception as e:
        print(f"Error saving history: {e}")


def read_uploaded_file(file: UploadFile) -> pd.DataFrame:
    """Reads CSV or Excel file safely into pandas DataFrame."""
    content = file.file.read()
    filename = file.filename or "dataset.csv"
    
    try:
        if filename.endswith(".csv") or filename.endswith(".txt"):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content))
        else:
            # Try CSV fallback
            df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file '{filename}': {str(e)}")
        
    return df


def seed_default_demo_if_empty():
    """Generates clean real demonstration data if no dataset uploaded yet."""
    global _ACTIVE_SESSION
    if _ACTIVE_SESSION["train_df"] is not None:
        return

    np.random.seed(42)
    n_train = 400
    n_test = 200
    
    # Industrial Thermal & Fire Sensor Screening benchmark
    train_data = {
        "device_id": [f"SN-{1000 + i}" for i in range(n_train)],
        "temperature_c": np.round(np.random.normal(68.5, 12.0, n_train), 2),
        "temp_gradient_min": np.round(np.random.exponential(1.5, n_train), 2),
        "smoke_obscuration_pct": np.round(np.clip(np.random.normal(2.1, 4.5, n_train), 0, 100), 2),
        "co_concentration_ppm": np.round(np.clip(np.random.normal(8.0, 15.0, n_train), 0, 500), 1),
        "ambient_humidity_pct": np.round(np.random.uniform(25.0, 85.0, n_train), 1),
        "chamber_zone": np.random.choice(["Zone-A", "Zone-B", "Zone-C", "Zone-D"], n_train),
    }
    # Synthetic label: Fire risk event
    train_df = pd.DataFrame(train_data)
    is_fire = (
        (train_df["temperature_c"] > 85.0) & (train_df["smoke_obscuration_pct"] > 10.0)
    ) | (train_df["co_concentration_ppm"] > 45.0) | (train_df["temp_gradient_min"] > 6.0)
    train_df["hazard_class"] = np.where(is_fire, "Critical Hazard", "Nominal")
    
    test_data = {
        "device_id": [f"TEST-{2000 + i}" for i in range(n_test)],
        "temperature_c": np.round(np.random.normal(70.0, 14.0, n_test), 2),
        "temp_gradient_min": np.round(np.random.exponential(1.8, n_test), 2),
        "smoke_obscuration_pct": np.round(np.clip(np.random.normal(2.4, 5.2, n_test), 0, 100), 2),
        "co_concentration_ppm": np.round(np.clip(np.random.normal(9.0, 18.0, n_test), 0, 500), 1),
        "ambient_humidity_pct": np.round(np.random.uniform(20.0, 80.0, n_test), 1),
        "chamber_zone": np.random.choice(["Zone-A", "Zone-B", "Zone-C", "Zone-D"], n_test),
    }
    test_df = pd.DataFrame(test_data)
    
    _ACTIVE_SESSION["train_df"] = train_df
    _ACTIVE_SESSION["test_df"] = test_df
    _ACTIVE_SESSION["train_meta"] = inspect_dataset_dataframe(train_df)
    _ACTIVE_SESSION["test_meta"] = inspect_dataset_dataframe(test_df)
    _ACTIVE_SESSION["train_filename"] = "industrial_sensor_train.csv (Demo)"
    _ACTIVE_SESSION["test_filename"] = "industrial_sensor_test.csv (Demo)"
    
    # Train benchmark automatically
    benchmark = train_and_benchmark(train_df, target_col="hazard_class", problem_type="classification")
    _ACTIVE_SESSION["benchmark"] = benchmark
    _ACTIVE_SESSION["pipeline"] = benchmark["pipeline"]
    
    # Predict test data
    pred_df, summary = predict_dataset(benchmark["pipeline"], test_df, "classification", "hazard_class")
    _ACTIVE_SESSION["predictions_df"] = pred_df
    _ACTIVE_SESSION["prediction_summary"] = summary


@router.get("/health")
def health_check():
    return {
        "status": "online",
        "module": "AEGISBURN AI",
        "version": "2.0.0",
        "architecture": "AutoML Screening & Anomaly Engine"
    }


@router.get("/session")
def get_current_session():
    """Returns overview of current active workspace session."""
    seed_default_demo_if_empty()
    
    return {
        "analysis_id": _ACTIVE_SESSION["analysis_id"],
        "has_train": _ACTIVE_SESSION["train_df"] is not None,
        "has_test": _ACTIVE_SESSION["test_df"] is not None,
        "has_model": _ACTIVE_SESSION["pipeline"] is not None,
        "has_predictions": _ACTIVE_SESSION["predictions_df"] is not None,
        "train_filename": _ACTIVE_SESSION.get("train_filename"),
        "test_filename": _ACTIVE_SESSION.get("test_filename"),
        "train_meta": _ACTIVE_SESSION.get("train_meta"),
        "test_meta": _ACTIVE_SESSION.get("test_meta"),
        "selected_model": _ACTIVE_SESSION.get("benchmark", {}).get("best_model_name"),
        "problem_type": _ACTIVE_SESSION.get("benchmark", {}).get("problem_type"),
        "prediction_summary": _ACTIVE_SESSION.get("prediction_summary"),
        "last_updated": _ACTIVE_SESSION.get("last_updated")
    }


@router.post("/datasets/training")
async def upload_training_dataset(file: UploadFile = File(...)):
    """Uploads and inspects user-provided training dataset (CSV/XLSX)."""
    df = read_uploaded_file(file)
    meta = inspect_dataset_dataframe(df)
    
    _ACTIVE_SESSION["train_df"] = df
    _ACTIVE_SESSION["train_meta"] = meta
    _ACTIVE_SESSION["train_filename"] = file.filename
    _ACTIVE_SESSION["last_updated"] = datetime.now(timezone.utc).isoformat()
    _ACTIVE_SESSION["analysis_id"] = f"ANALYSIS #{np.random.randint(1000, 9999)}"
    
    return {
        "status": "success",
        "filename": file.filename,
        "metadata": meta
    }


@router.post("/datasets/testing")
async def upload_testing_dataset(file: UploadFile = File(...)):
    """Uploads and inspects user-provided testing dataset (CSV/XLSX)."""
    df = read_uploaded_file(file)
    meta = inspect_dataset_dataframe(df)
    
    _ACTIVE_SESSION["test_df"] = df
    _ACTIVE_SESSION["test_meta"] = meta
    _ACTIVE_SESSION["test_filename"] = file.filename
    _ACTIVE_SESSION["last_updated"] = datetime.now(timezone.utc).isoformat()
    
    # Clear previous predictions
    _ACTIVE_SESSION["predictions_df"] = None
    _ACTIVE_SESSION["prediction_summary"] = None
    
    return {
        "status": "success",
        "filename": file.filename,
        "metadata": meta
    }


@router.get("/schema-comparison")
def get_schema_comparison(target_col: Optional[str] = None):
    """Compares uploaded train and test schemas."""
    seed_default_demo_if_empty()
    train_df = _ACTIVE_SESSION.get("train_df")
    test_df = _ACTIVE_SESSION.get("test_df")
    
    if train_df is None or test_df is None:
        raise HTTPException(status_code=400, detail="Both training and testing datasets must be loaded.")
        
    return compare_schemas(train_df, test_df, target_col=target_col)


class TrainRequest(BaseModel):
    target_col: Optional[str] = None
    problem_type: str = "auto"
    selected_features: Optional[List[str]] = None
    test_size: float = 0.2
    random_state: int = 42


@router.post("/train-and-benchmark")
def train_and_benchmark_models(req: TrainRequest):
    """Executes AutoML model selection, cross-validation, and benchmarking."""
    seed_default_demo_if_empty()
    train_df = _ACTIVE_SESSION.get("train_df")
    if train_df is None:
        raise HTTPException(status_code=400, detail="Training dataset not loaded.")
        
    try:
        benchmark = train_and_benchmark(
            train_df=train_df,
            target_col=req.target_col,
            problem_type=req.problem_type,
            selected_features=req.selected_features,
            test_size=req.test_size,
            random_state=req.random_state
        )
        
        _ACTIVE_SESSION["benchmark"] = benchmark
        _ACTIVE_SESSION["pipeline"] = benchmark["pipeline"]
        _ACTIVE_SESSION["last_updated"] = datetime.now(timezone.utc).isoformat()
        
        # Save snapshot to history
        save_history({
            "analysis_id": _ACTIVE_SESSION["analysis_id"],
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "train_file": _ACTIVE_SESSION.get("train_filename", "train.csv"),
            "test_file": _ACTIVE_SESSION.get("test_filename", "test.csv"),
            "best_model": benchmark["best_model_name"],
            "problem_type": benchmark["problem_type"],
            "train_records": len(train_df),
            "status": "Model Ready"
        })
        
        # Omit non-serializable Pipeline object in response
        res = {k: v for k, v in benchmark.items() if k != "pipeline"}
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failure: {str(e)}")


@router.post("/predict")
def run_predictions():
    """Generates predictions and anomaly scores for the uploaded testing dataset."""
    seed_default_demo_if_empty()
    pipeline = _ACTIVE_SESSION.get("pipeline")
    test_df = _ACTIVE_SESSION.get("test_df")
    benchmark = _ACTIVE_SESSION.get("benchmark")
    
    if pipeline is None:
        raise HTTPException(status_code=400, detail="No trained model pipeline available. Train a model first.")
    if test_df is None:
        raise HTTPException(status_code=400, detail="No testing dataset loaded.")
        
    problem_type = benchmark.get("problem_type", "classification") if benchmark else "classification"
    target_col = benchmark.get("target_col") if benchmark else None
    
    try:
        pred_df, summary = predict_dataset(pipeline, test_df, problem_type, target_col)
        _ACTIVE_SESSION["predictions_df"] = pred_df
        _ACTIVE_SESSION["prediction_summary"] = summary
        _ACTIVE_SESSION["last_updated"] = datetime.now(timezone.utc).isoformat()
        
        return {
            "status": "success",
            "summary": summary,
            "total_predictions": len(pred_df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@router.get("/predictions")
def get_predictions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=500),
    search: Optional[str] = None,
    risk_filter: Optional[str] = None
):
    """Returns paginated, searchable, and filtered prediction records."""
    seed_default_demo_if_empty()
    pred_df = _ACTIVE_SESSION.get("predictions_df")
    
    if pred_df is None:
        return {"records": [], "total": 0, "page": page, "page_size": page_size}
        
    df = pred_df.copy()
    
    # Filter
    if risk_filter and risk_filter != "ALL":
        if "risk_level" in df.columns:
            df = df[df["risk_level"].astype(str).str.upper().str.contains(risk_filter.upper())]
        elif "predicted_class" in df.columns:
            df = df[df["predicted_class"].astype(str).str.upper() == risk_filter.upper()]
            
    # Search
    if search:
        search_lower = search.lower()
        mask = df.astype(str).apply(lambda row: row.str.lower().str.contains(search_lower).any(), axis=1)
        df = df[mask]
        
    total_records = len(df)
    start = (page - 1) * page_size
    end = start + page_size
    
    # Clean NaN values for JSON
    paged_rows = df.iloc[start:end].replace({np.nan: None}).to_dict(orient="records")
    
    # Attach row identifiers
    for idx, r in enumerate(paged_rows):
        r["_row_id"] = start + idx + 1
        dec = _ACTIVE_SESSION["review_decisions"].get(start + idx + 1)
        if dec:
            r["user_decision"] = dec
            
    return {
        "records": paged_rows,
        "total": total_records,
        "page": page,
        "page_size": page_size,
        "columns": list(df.columns)
    }


class ReviewDecisionRequest(BaseModel):
    decision: str # Needs Review, Investigating, Confirmed Anomaly, False Positive


@router.post("/records/{row_id}/review")
def update_record_review(row_id: int, req: ReviewDecisionRequest):
    """Updates the user investigation status of an individual record."""
    _ACTIVE_SESSION["review_decisions"][row_id] = req.decision
    return {"status": "success", "row_id": row_id, "decision": req.decision}


@router.get("/export")
def export_predictions(format: str = Query("csv", pattern="^(csv|json|xlsx)$")):
    """Exports prediction results as a downloadable file."""
    seed_default_demo_if_empty()
    pred_df = _ACTIVE_SESSION.get("predictions_df")
    
    if pred_df is None:
        raise HTTPException(status_code=400, detail="No prediction records available to export.")
        
    if format == "csv":
        csv_data = pred_df.to_csv(index=False)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=aegisburn_predictions_{int(datetime.now().timestamp())}.csv"}
        )
    elif format == "json":
        json_data = pred_df.to_json(orient="records", indent=2)
        return Response(
            content=json_data,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=aegisburn_predictions_{int(datetime.now().timestamp())}.json"}
        )
    else:
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            pred_df.to_excel(writer, index=False)
        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=aegisburn_predictions_{int(datetime.now().timestamp())}.xlsx"}
        )


@router.get("/report")
def generate_summary_report():
    """Generates structured analysis audit report."""
    seed_default_demo_if_empty()
    
    return {
        "analysis_id": _ACTIVE_SESSION.get("analysis_id"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "train_file": _ACTIVE_SESSION.get("train_filename"),
        "test_file": _ACTIVE_SESSION.get("test_filename"),
        "model_used": _ACTIVE_SESSION.get("benchmark", {}).get("best_model_name"),
        "problem_type": _ACTIVE_SESSION.get("benchmark", {}).get("problem_type"),
        "summary": _ACTIVE_SESSION.get("prediction_summary"),
        "benchmark_results": _ACTIVE_SESSION.get("benchmark", {}).get("benchmark_results"),
        "feature_importance": _ACTIVE_SESSION.get("benchmark", {}).get("feature_importance")
    }


@router.get("/history")
def get_analysis_history():
    return load_history()
