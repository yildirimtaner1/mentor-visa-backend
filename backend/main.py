import os
import uuid
import json
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Security, Form
from typing import Optional
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import ai_service
from pydantic import ValidationError, BaseModel
import jwt
from jwt import PyJWKClient
from dotenv import load_dotenv
import datetime
from supabase import create_client, Client
import stripe
from fastapi import Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import database
import db_models
import journey_models  # PR Journey system models
from sqlalchemy.orm import Session

# Create uploads directory
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
stripe.api_version = "2024-06-20"  # Pin for stability — avoids Dahlia breaking changes
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Dev cache mode — set DEV_CACHE_MODE=1 in .env to avoid burning API credits
DEV_CACHE_MODE = os.getenv("DEV_CACHE_MODE", "0") == "1"
DEV_CACHE_DIR = Path(__file__).parent / ".dev_cache"
if DEV_CACHE_MODE:
    DEV_CACHE_DIR.mkdir(exist_ok=True)
    print("⚡ DEV_CACHE_MODE is ON — AI responses will be cached locally to save API credits.")

import json as json_module
def _load_cache(cache_name: str):
    """Load a cached JSON response if it exists."""
    cache_file = DEV_CACHE_DIR / f"{cache_name}.json"
    if cache_file.exists():
        with open(cache_file, 'r', encoding='utf-8') as f:
            print(f"  📦 Cache HIT: {cache_name}")
            return json_module.load(f)
    return None

def _save_cache(cache_name: str, data: dict):
    """Save a JSON response to cache."""
    cache_file = DEV_CACHE_DIR / f"{cache_name}.json"
    with open(cache_file, 'w', encoding='utf-8') as f:
        json_module.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  💾 Cache SAVED: {cache_name}")

# Setup Clerk JWKS client
CLERK_ISSUER_URL = os.getenv("CLERK_ISSUER_URL")

# Setup Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Create tables
db_models.Base.metadata.create_all(bind=database.engine)
journey_models.PRJourney.__table__.create(bind=database.engine, checkfirst=True)
journey_models.DocumentItem.__table__.create(bind=database.engine, checkfirst=True)
journey_models.DrawResult.__table__.create(bind=database.engine, checkfirst=True)
journey_models.NOCCategoryMapping.__table__.create(bind=database.engine, checkfirst=True)

ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'}
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'}

app = FastAPI(
    title="Mentor Visa Analyzer API",
    description="Canadian Experience Class (CEC) Document Analysis API powered by Google Gemini",
    version="2.0.0"
)

# Allow React frontend to connect to this API
# Setup Rate Limiter (IP Based)
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Register Journey routes
from journey_routes import router as journey_router
app.include_router(journey_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://mentorvisa.com",
        "https://www.mentorvisa.com",
        "http://localhost:5173", # Dev frontend
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/v1/analyze")
@limiter.limit("7/hour")
async def analyze_document_endpoint(
    request: Request,
    document: UploadFile = File(...),
    target_noc: Optional[str] = Form(None)
):
    """
    Accepts a document (PDF, Word, or Image).
    The AI Service auto-detects the NOC code and evaluates the document against the NOC 2021 Source of Truth.
    Saves the original file to disk and injects the file reference into the response.
    """
    filename = document.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type '{ext}'. Accepted formats: PDF, Word (.docx), and images (JPG, PNG, etc.)."
        )
        
    try:
        doc_bytes = await document.read()
        
        # Enforce 5MB max file size
        MAX_FILE_SIZE = 5 * 1024 * 1024
        if len(doc_bytes) > MAX_FILE_SIZE:
             raise HTTPException(
                status_code=413, 
                detail="File too large. Maximum file size allowed is 5MB."
             )
             
        is_image = ext in IMAGE_EXTENSIONS
        
        # Save the original file
        file_id = str(uuid.uuid4())
        stored_filename = f"{file_id}{ext}"
        
        if supabase:
            _MIME_MAP = {
                '.pdf': 'application/pdf',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                '.doc': 'application/msword',
            }
            content_type = _MIME_MAP.get(ext, f"image/{ext.replace('.', '')}")
            supabase.storage.from_("documents").upload(
                path=stored_filename,
                file=doc_bytes,
                file_options={"content-type": content_type}
            )
        else:
            file_path = UPLOADS_DIR / stored_filename
            with open(file_path, "wb") as f:
                f.write(doc_bytes)
        
        # DEV CACHE: return cached response if available
        if DEV_CACHE_MODE:
            cached = _load_cache("analyze")
            if cached:
                cached["stored_file_id"] = file_id
                cached["original_filename"] = filename
                # Still save to DB so unlock flow works
                db = database.SessionLocal()
                try:
                    record = db_models.Evaluation(
                        evaluation_type='audit',
                        user_id="anonymous",
                        document_type=cached.get("document_type", "Unknown"),
                        role_name=cached.get("role_name", "Unknown Role"),
                        company_name=cached.get("company_name", "Unknown Company"),
                        original_filename=filename,
                        stored_file_id=file_id,
                        compliance_status=cached.get("decision", cached.get("compliance_status", "Unknown")),
                        payload=cached,
                    )
                    db.add(record)
                    db.commit()
                except Exception as log_err:
                    print(f"Warning: failed to auto-log cached evaluation: {log_err}")
                finally:
                    db.close()
                return cached

        result_json = ai_service.analyze_document_with_ai(
            uploaded_doc_bytes=doc_bytes,
            file_extension=ext,
            is_image=is_image,
            target_noc=target_noc
        )
        
        # Inject file metadata into the response
        result_json["stored_file_id"] = file_id
        result_json["original_filename"] = filename
        
        # Save to dev cache for future re-use
        if DEV_CACHE_MODE:
            _save_cache("analyze", result_json)

        # Auto-log every analysis to the database for admin review
        db = database.SessionLocal()
        try:
            record = db_models.Evaluation(
                evaluation_type='audit',
                user_id="anonymous",
                document_type=result_json.get("document_type", "Unknown"),
                role_name=result_json.get("role_name", "Unknown Role"),
                company_name=result_json.get("company_name", "Unknown Company"),
                original_filename=filename,
                stored_file_id=file_id,
                compliance_status=result_json.get("decision", "Unknown"),
                payload=result_json,
            )
            db.add(record)
            db.commit()
        except Exception as log_err:
            print(f"Warning: failed to auto-log evaluation: {log_err}")
        finally:
            db.close()
        
        return result_json
        
    except ValidationError as ve:
        raise HTTPException(status_code=500, detail=f"Model JSON Validation Error: {ve}")
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"AI Processing failed: {str(e)}")

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Mentor Visa API is running"}

# --- Auth Dependency ---
security = HTTPBearer()

# Cache the JWKS client globally to avoid re-creating on every request
_jwks_client = None
def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None and CLERK_ISSUER_URL:
        jwks_url = f"{CLERK_ISSUER_URL}/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    
    try:
        if not CLERK_ISSUER_URL:
            # Dev fallback: decode without signature verification
            claims = jwt.decode(token, options={"verify_signature": False})
            user_id = claims.get("sub")
            if not user_id:
                raise HTTPException(status_code=401, detail="No user ID in token")
            return user_id

        jwks_client = _get_jwks_client()
        if not jwks_client:
            raise HTTPException(status_code=500, detail="JWKS client not configured")
        
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        data = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER_URL,
            options={"verify_signature": True}
        )
        user_id = data.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="No user ID in token")
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

# --- DB Endpoints ---

def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))):
    if not credentials:
        return "anonymous"
    try:
        return get_current_user(credentials)
    except Exception:
        return "anonymous"

def ensure_user_exists(user_id: str, db: Session):
    """Create a UserAccount row if one doesn't exist yet (idempotent).
    Must be called before inserting any row with a FK to users.user_id.
    New users receive 5 free AI Assistant credits."""
    if not user_id or user_id == "anonymous":
        return
    existing = db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
    if not existing:
        db.add(db_models.UserAccount(user_id=user_id, find_noc_credits=0, audit_letter_credits=0, profile_builder_credits=5))
        db.commit()

@app.post("/api/v1/evaluations")
def save_evaluation(
    payload: dict,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    try:
        ensure_user_exists(user_id, db)
        doc_type = payload.get("document_type", "Unknown")
        compliance = payload.get("decision", payload.get("compliance_status", "Unknown"))
        role_name = payload.get("role_name", "Unknown Role")
        company_name = payload.get("company_name", "Unknown Company")
        
        original_filename = payload.get("original_filename", None)
        stored_file_id = payload.get("stored_file_id", None)
        
        eval_type = payload.get("evaluation_type")
        if not eval_type:
            eval_type = 'noc_finder' if (doc_type == "NOC Finder Query") else 'audit'

        # CRS calculator: always create a new record to maintain full history.
        # The latest calculation is determined by the most recent created_at timestamp.

        # UPSERT: If a record with this stored_file_id already exists, claim it
        # for the current user instead of creating a duplicate.
        if stored_file_id:
            Model = db_models.Evaluation
            existing = db.query(Model).filter_by(stored_file_id=stored_file_id, evaluation_type=eval_type).first()
            if existing:
                # If it's owned by someone else, do not allow modifications
                if existing.user_id != "anonymous" and existing.user_id != user_id:
                    return {"success": True, "id": existing.id}
                    
                # Update payload to the latest state from frontend
                existing.payload = payload
                
                # Claim anonymous records for this user
                if existing.user_id == "anonymous":
                    existing.user_id = user_id
                    
                # Only automatically unlock free tools (like NOC Finder or CRS Calculator)
                if eval_type in ["noc_finder", "crs_calculator"]:
                    existing.is_premium_unlocked = 1 
                
                db.commit()
                return {"success": True, "id": existing.id}

        # No existing record found — create a new one
        is_unlocked = 1 if payload.get("is_premium_unlocked") else 0
        if eval_type in ["noc_finder", "crs_calculator"]:
            is_unlocked = 1  # Always unlocked

        record = db_models.Evaluation(
            evaluation_type=eval_type,
            user_id=user_id,
            document_type=doc_type,
            role_name=role_name,
            company_name=company_name,
            original_filename=original_filename,
            stored_file_id=stored_file_id,
            compliance_status=compliance,
            is_premium_unlocked=is_unlocked,
            payload=payload
        )

        db.add(record)
        db.commit()
        db.refresh(record)
        return {"success": True, "id": record.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/evaluations")
def get_evaluations(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    audit_records = db.query(db_models.Evaluation).filter_by(evaluation_type='audit', user_id=user_id).all()
    
    noc_records = db.query(db_models.Evaluation).filter_by(evaluation_type='noc_finder', user_id=user_id).all()

    crs_records = db.query(db_models.Evaluation).filter_by(evaluation_type='crs_calculator', user_id=user_id).all()
    
    all_records = audit_records + noc_records + crs_records
    
    result = []
    for r in all_records:
        result.append({
            "id": r.id,
            "document_type": r.document_type,
            "role_name": r.role_name,
            "company_name": r.company_name,
            "original_filename": r.original_filename,
            "stored_file_id": r.stored_file_id,
            "compliance_status": r.compliance_status,
            "is_premium_unlocked": bool(r.is_premium_unlocked),
            "timestamp": (r.timestamp_utc.isoformat() + 'Z') if r.timestamp_utc else None,
            "payload": r.payload,
        })
        
    # Sort in memory descending by timestamp
    result.sort(key=lambda x: x["timestamp"] or '', reverse=True)
    
    
    
    return {"evaluations": result}

@app.get("/api/v1/documents/{file_id}")
def download_document(
    file_id: str,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Download the original uploaded document. Only the owner can access it."""
    record = db.query(db_models.Evaluation).filter(
        db_models.Evaluation.evaluation_type == 'audit',
        db_models.Evaluation.user_id == user_id,
        db_models.Evaluation.stored_file_id == file_id
    ).first()
    
    if not record:
        record = db.query(db_models.Evaluation).filter(
            db_models.Evaluation.evaluation_type == 'noc_finder',
            db_models.Evaluation.user_id == user_id,
            db_models.Evaluation.stored_file_id == file_id
        ).first()
        
    if not record:
        raise HTTPException(status_code=404, detail="Document not found or access denied.")
    
    # Resolve the actual storage file_id — re-evaluation records store a synthetic ID
    # but the real file lives under the original_file_id
    actual_file_id = file_id
    if "_reeval_" in file_id:
        payload = record.payload if isinstance(record.payload, dict) else {}
        actual_file_id = payload.get("original_file_id", file_id.split("_reeval_")[0])
    
    if supabase:
        from fastapi.responses import RedirectResponse
        ext = os.path.splitext(record.original_filename)[1].lower() if record.original_filename else ".pdf"
        stored_filename = f"{actual_file_id}{ext}"
        try:
            sign_res = supabase.storage.from_("documents").create_signed_url(stored_filename, 3600)
            url = sign_res.get("signedURL") if isinstance(sign_res, dict) else sign_res
            if url:
                return RedirectResponse(url)
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"File not securely found in cloud: {e}")

    # Fallback to local disk
    for ext in ALLOWED_EXTENSIONS:
        candidate = UPLOADS_DIR / f"{actual_file_id}{ext}"
        if candidate.exists():
            return FileResponse(
                path=str(candidate),
                filename=record.original_filename or f"document{ext}",
                media_type="application/octet-stream"
            )
    
    raise HTTPException(status_code=404, detail="File not found on server or cloud.")

class ReevaluateRequest(BaseModel):
    file_id: str
    target_noc: str
    mode: str = "audit"  # "audit" or "noc_finder"

@app.post("/api/v1/reevaluate")
def reevaluate_document(
    req: ReevaluateRequest,
    user_id: str = Depends(get_current_user_optional),
    db: Session = Depends(database.get_db)
):
    """Re-runs the AI analysis on an already uploaded document, forcing a specific NOC code."""
    ensure_user_exists(user_id, db)
    record = db.query(db_models.Evaluation).filter_by(evaluation_type='audit', stored_file_id=req.file_id).first()
    
    if not record:
        record = db.query(db_models.Evaluation).filter_by(evaluation_type='noc_finder', stored_file_id=req.file_id).first()

    if not record:
        raise HTTPException(status_code=404, detail="Document not found.")

    if record.user_id != "anonymous" and record.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied. You do not own this document.")

    
    ext = os.path.splitext(record.original_filename)[1].lower() if record.original_filename else ".pdf"
    is_image = ext in IMAGE_EXTENSIONS
    doc_bytes = None
    
    # Resolve actual storage file_id — re-evaluation records have synthetic IDs
    actual_file_id = req.file_id
    if "_reeval_" in req.file_id:
        payload = record.payload if isinstance(record.payload, dict) else {}
        actual_file_id = payload.get("original_file_id", req.file_id.split("_reeval_")[0])
    
    # Check if this was a text-only input (no file was uploaded)
    is_text_only = record.original_filename in (None, "", "Text Input")
    
    if is_text_only:
        # No file to download — the user typed their input manually.
        # The original text is stored in the record's payload.
        doc_bytes = None  # Will be handled specially in the noc_finder path below
    elif supabase:
        stored_filename = f"{actual_file_id}{ext}"
        try:
            res = supabase.storage.from_("documents").download(stored_filename)
            doc_bytes = res
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Failed to fetch original file from cloud: {e}")
    else:
        file_path = UPLOADS_DIR / f"{actual_file_id}{ext}"
        if file_path.exists():
            with open(file_path, "rb") as f:
                doc_bytes = f.read()
    
    if not doc_bytes and not is_text_only:
        raise HTTPException(status_code=404, detail="Original file content could not be found.")
        
    try:
        if req.mode == "noc_finder":
            # NOC Finder re-evaluation: use the NOC Finder prompt + schema
            import json as _json
            from models import NOCFinderResponseSchema
            
            user_content = ""
            page_images = []
            
            if is_text_only:
                # Reconstruct the user's original typed input from the stored payload
                payload = record.payload if isinstance(record.payload, dict) else {}
                original_title = payload.get("user_input_job_title", payload.get("role_name", "Unknown Role"))
                original_duties = payload.get("user_input_duties", "")
                user_content = f"Job Title: {original_title}\n\nDuties and Responsibilities:\n{original_duties}"
                print(f"Re-evaluating text-only input: title='{original_title}', duties length={len(original_duties)}")
            elif is_image:
                user_content = "The user uploaded an image of their employment letter. Extract the job title and duties."
                mime_type = ai_service.IMAGE_MIME_TYPES.get(ext, 'image/jpeg')
                page_images.append((doc_bytes, mime_type))
            elif ext == '.pdf':
                page_images = ai_service.pdf_pages_to_images(doc_bytes)
                extracted_text = ai_service.extract_text_from_pdf(doc_bytes)
                user_content = f"=== EXTRACTED PDF TEXT ===\n{extracted_text}"
            else:
                if ext in ('.docx', '.doc'):
                    user_content = f"=== EXTRACTED WORD TEXT ===\n{ai_service.extract_text_from_docx(doc_bytes)}"
                else:
                    user_content = f"=== EXTRACTED TEXT ===\n{doc_bytes.decode('utf-8', errors='replace')}"
            
            top_nocs = ai_service.semantic_search_nocs(user_content, top_k=20)
            
            # Auditor Fix: Always include the target_noc in the reference sheet so the AI can evaluate against it!
            if req.target_noc:
                target_data = next((data for data in ai_service.NOC_INDEX.values() if data.get("code") == req.target_noc), None)
                if target_data:
                    top_nocs[req.target_noc] = target_data
                    
            noc_reference = _json.dumps(top_nocs, ensure_ascii=False)
            system_prompt = ai_service.build_noc_finder_prompt(noc_reference, req.target_noc)
            
            try:
                import openai
                result_json = ai_service.find_noc_with_openai(
                    system_prompt=system_prompt,
                    user_content=f"=== USER INPUT ===\n{user_content}",
                    page_images=page_images if page_images else None
                )
            except openai.RateLimitError:
                raise HTTPException(status_code=429, detail="OpenAI Rate Limit Exceeded. Please try again later.")
            except openai.APIError as e:
                raise HTTPException(status_code=502, detail=f"OpenAI API Error: {str(e)}")
            except Exception as e:
                print(f"OpenAI processing error: {e}")
                raise HTTPException(status_code=500, detail=f"AI Processing failed: {str(e)}")
            
            # Generate a unique file_id for this re-evaluation
            reeval_file_id = f"{req.file_id}_reeval_{str(uuid.uuid4())[:8]}"
            result_json["stored_file_id"] = reeval_file_id
            result_json["original_file_id"] = actual_file_id
            result_json["is_signed_in"] = 1  # NOC Finder uses is_signed_in, not is_premium_unlocked
            
            # Persist to DB so it shows in My Evaluations
            saved_role = result_json.get("role_name") or record.role_name or "Unknown Role"
            saved_company = result_json.get("company_name") or record.company_name or "N/A"
            new_record = db_models.Evaluation(
                evaluation_type='noc_finder',
                user_id=user_id if user_id else record.user_id,
                document_type="NOC Finder Query",
                role_name=saved_role,
                company_name=saved_company,
                original_filename=record.original_filename,
                stored_file_id=reeval_file_id,
                compliance_status="N/A",
                is_premium_unlocked=1,
                payload=result_json,
            )
            db.add(new_record)
            db.commit()
            
            return result_json
        else:
            # Default: Auditor re-evaluation
            result_json = ai_service.analyze_document_with_ai(
                uploaded_doc_bytes=doc_bytes,
                file_extension=ext,
                is_image=is_image,
                target_noc=req.target_noc
            )
            
            # Generate a unique file_id for this reevaluation so it doesn't collide
            # with the original record during UPSERT. Keep original file_id as reference.
            reeval_file_id = f"{req.file_id}_reeval_{str(uuid.uuid4())[:8]}"
            
            result_json["stored_file_id"] = reeval_file_id
            result_json["original_file_id"] = req.file_id  # Reference to original document
            result_json["original_filename"] = record.original_filename
            # Inherit unlock status ONLY from audit source records.
            # If the source is a NOC Finder record (always unlocked for signed-in users),
            # the audit must NOT be auto-unlocked — audits require payment.
            audit_unlocked = 1 if (record.evaluation_type == 'audit' and record.is_premium_unlocked) else 0
            result_json["is_premium_unlocked"] = audit_unlocked
            
            # Include target NOC in metadata for display in My Evaluations
            if req.target_noc and req.target_noc != 'auto':
                result_json["reevaluated_against_noc"] = req.target_noc
            
            # Save as a brand new evaluation run
            new_record = db_models.Evaluation(
                evaluation_type='audit',
                user_id=user_id if user_id else record.user_id,
                document_type=result_json.get("document_type", "Unknown"),
                role_name=result_json.get("role_name", "Unknown Role"),
                company_name=result_json.get("company_name", "Unknown Company"),
                original_filename=record.original_filename,
                stored_file_id=reeval_file_id,
                compliance_status=result_json.get("decision", "Unknown"),
                is_premium_unlocked=audit_unlocked,
                payload=result_json,
            )
            db.add(new_record)
            db.commit()
            db.refresh(new_record)
            
            return result_json
        
    except ValidationError as ve:
        raise HTTPException(status_code=500, detail=f"Model JSON Validation Error: {ve}")
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"AI Processing failed: {str(e)}")

# --- NOC Finder Tool ---

from fastapi import Form
from typing import Optional
from models import NOCFinderResponseSchema

@app.post("/api/v1/noc-finder")
@limiter.limit("7/hour")
async def noc_finder_endpoint(
    request: Request,
    job_title: Optional[str] = Form(None),
    duties_description: Optional[str] = Form(None),
    document: Optional[UploadFile] = File(None),
    target_noc: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user_optional),
    db: Session = Depends(database.get_db)
):
    """
    Accepts EITHER a job title and duties description OR a document upload.
    Uses AI to match against all 516 NOC 2021 unit groups and returns the best match with alternatives.
    """
    import json as _json
    evaluation_id = str(uuid.uuid4())
    try:
        ensure_user_exists(user_id, db)
        if not document and not (job_title and duties_description):
            raise HTTPException(status_code=400, detail="Provide either a document upload OR both job_title & duties_description.")

        user_content = ""
        is_hybrid = False
        page_images = []
        
        if document:
            filename = document.filename or ""
            ext = os.path.splitext(filename)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'")
            
            doc_bytes = await document.read()
            
            stored_filename = f"{evaluation_id}{ext}"
            if supabase:
                _MIME_MAP = {
                    '.pdf': 'application/pdf',
                    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    '.doc': 'application/msword',
                }
                content_type = _MIME_MAP.get(ext, f"image/{ext.replace('.', '')}")
                supabase.storage.from_("documents").upload(
                    path=stored_filename,
                    file=doc_bytes,
                    file_options={"content-type": content_type}
                )
            else:
                file_path = UPLOADS_DIR / stored_filename
                with open(file_path, "wb") as f:
                    f.write(doc_bytes)
            
            is_image = ext in IMAGE_EXTENSIONS
            
            if is_image:
                user_content = f"The user uploaded an image of their employment letter. Extract the job title and duties."
                mime_type = ai_service.IMAGE_MIME_TYPES.get(ext, 'image/jpeg')
                page_images.append((doc_bytes, mime_type))
            elif ext == '.pdf':
                page_images = ai_service.pdf_pages_to_images(doc_bytes)
                extracted_text = ai_service.extract_text_from_pdf(doc_bytes)
                user_content = f"=== EXTRACTED PDF TEXT ===\n{extracted_text}"
            else:
                if ext in ('.docx', '.doc'):
                    user_content = f"=== EXTRACTED WORD TEXT ===\n{ai_service.extract_text_from_docx(doc_bytes)}"
                else:
                    user_content = f"=== EXTRACTED TEXT ===\n{doc_bytes.decode('utf-8', errors='replace')}"
        else:
            user_content = f"Job Title: {job_title}\nMain Duties: {duties_description}"

        top_nocs = ai_service.semantic_search_nocs(user_content, top_k=20)
        
        # Auditor Fix: Always include the target_noc in the reference sheet so the AI can evaluate against it!
        if target_noc:
            target_data = next((data for data in ai_service.NOC_INDEX.values() if data.get("code") == target_noc), None)
            if target_data:
                top_nocs[target_noc] = target_data
                
        noc_reference = _json.dumps(top_nocs, ensure_ascii=False)
        
        system_prompt = ai_service.build_noc_finder_prompt(noc_reference, target_noc)

        # DEV CACHE: return cached response if available
        if DEV_CACHE_MODE:
            cached = _load_cache("noc_finder")
            if cached:
                cached["stored_file_id"] = evaluation_id
                cached["is_premium_unlocked"] = 0
                new_record = db_models.Evaluation(
                evaluation_type='noc_finder',
                    user_id=user_id,
                    document_type="NOC Finder Query",
                    role_name=job_title or "Unknown Role",
                    company_name="N/A",
                    original_filename=document.filename if document else "Text Input",
                    stored_file_id=evaluation_id,
                    compliance_status="N/A",
                    is_premium_unlocked=0,
                    payload=cached,
                )
                db.add(new_record)
                db.commit()
                return cached

        try:
            import openai
            result = ai_service.find_noc_with_openai(
                system_prompt=system_prompt,
                user_content=f"=== USER INPUT ===\n{user_content}",
                page_images=page_images if page_images else None
            )
        except openai.RateLimitError as e:
            print(f"OpenAI RateLimitError details: {e.response.json() if hasattr(e, 'response') else str(e)}")
            raise HTTPException(status_code=429, detail=f"OpenAI Rate Limit Exceeded: {str(e)}")
        except openai.APIError as e:
            raise HTTPException(status_code=502, detail=f"OpenAI API Error: {str(e)}")
        except Exception as e:
            print(f"OpenAI processing error: {e}")
            raise HTTPException(status_code=500, detail=f"AI Processing failed: {str(e)}")
        result["stored_file_id"] = evaluation_id
        # NOC Finder is free for signed-in users
        is_signed_in = user_id and user_id != "anonymous"
        result["is_signed_in"] = 1 if is_signed_in else 0

        # Persist the raw user input so we can review what people are typing
        if job_title:
            result["user_input_job_title"] = job_title
        if duties_description:
            result["user_input_duties"] = duties_description
        
        # Save to dev cache for future re-use
        if DEV_CACHE_MODE:
            _save_cache("noc_finder", result)

        # Save to DB
        # Use AI-extracted role/company from the response, fall back to typed input
        saved_role = result.get("role_name") or job_title or "Unknown Role"
        saved_company = result.get("company_name") or "N/A"
        new_record = db_models.Evaluation(
                evaluation_type='noc_finder',
            user_id=user_id,
            document_type="NOC Finder Query",
            role_name=saved_role,
            company_name=saved_company,
            original_filename=document.filename if document else "Text Input",
            stored_file_id=evaluation_id,
            compliance_status="N/A",
            is_premium_unlocked=1 if is_signed_in else 0,
            payload=result,
        )
        db.add(new_record)
        db.commit()
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NOC Finder failed: {str(e)}")

# --- Bank Letter Auditor Tool ---

import bank_letter_service

@app.post("/api/v1/bank-letter-audit")
@limiter.limit("5/hour")
async def bank_letter_audit_endpoint(
    request: Request,
    document: UploadFile = File(...),
    user_id: str = Depends(get_current_user_optional),
    db: Session = Depends(database.get_db)
):
    """
    Accepts a bank letter (PDF, Word, or Image) and audits it against IRCC's
    7 required elements for proof of settlement funds.
    """
    ensure_user_exists(user_id, db)
    
    filename = document.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Accepted: PDF, Word (.docx), and images."
        )
    
    try:
        doc_bytes = await document.read()
        
        MAX_FILE_SIZE = 5 * 1024 * 1024
        if len(doc_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum 5MB.")
        
        is_image = ext in IMAGE_EXTENSIONS
        
        # Save the original file
        file_id = str(uuid.uuid4())
        stored_filename = f"{file_id}{ext}"
        
        if supabase:
            _MIME_MAP = {
                '.pdf': 'application/pdf',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                '.doc': 'application/msword',
            }
            content_type = _MIME_MAP.get(ext, f"image/{ext.replace('.', '')}")
            supabase.storage.from_("documents").upload(
                path=stored_filename,
                file=doc_bytes,
                file_options={"content-type": content_type}
            )
        else:
            file_path = UPLOADS_DIR / stored_filename
            with open(file_path, "wb") as f:
                f.write(doc_bytes)
        
        # Run the AI audit
        result_json = bank_letter_service.audit_bank_letter(doc_bytes, ext, is_image)
        
        # Inject file metadata
        result_json["stored_file_id"] = file_id
        result_json["original_filename"] = filename
        result_json["evaluation_type"] = "bank_letter_audit"
        
        # Save to DB
        compliance = result_json.get("overall_compliance", "unknown")
        record = db_models.Evaluation(
            evaluation_type='bank_letter_audit',
            user_id=user_id,
            document_type="Bank Letter",
            role_name="Proof of Funds",
            company_name=result_json.get("bank_name", "Unknown Bank"),
            original_filename=filename,
            stored_file_id=file_id,
            compliance_status=compliance,
            is_premium_unlocked=0,  # Requires payment to unlock
            payload=result_json,
        )
        db.add(record)
        db.commit()
        
        return result_json
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bank letter audit failed: {str(e)}")

# --- Letter Builder Tool ---


from letter_builder_models import DutyAnalysisRequest, LetterGenerationRequest

@app.get("/api/v1/letter-builder/noc-duties/{noc_code}")
def get_noc_duties(noc_code: str):
    """Returns the official duties list for a given NOC code from the index."""
    entry = ai_service.get_noc_details(noc_code)
    if not entry:
        raise HTTPException(status_code=404, detail=f"NOC code {noc_code} not found.")
    
    duties = entry.get("duties", [])
    return {
        "noc_code": noc_code,
        "noc_title": entry.get("title", ""),
        "lead_statement": entry.get("lead_statement", ""),
        "duties": [{"duty_text": d, "index": i} for i, d in enumerate(duties)]
    }


@app.post("/api/v1/letter-builder/analyze-duty")
@limiter.limit("20/hour")
async def analyze_duty_endpoint(
    request: Request,
    req: DutyAnalysisRequest,
    user_id: str = Depends(get_current_user),
):
    """Analyze a single user-written duty against a target NOC code."""
    if not req.duty_text.strip():
        raise HTTPException(status_code=400, detail="Duty text cannot be empty.")
    if len(req.duty_text) > 2000:
        raise HTTPException(status_code=400, detail="Duty text too long (max 2000 characters).")
    
    try:
        result = ai_service.analyze_single_duty(req.duty_text.strip(), req.noc_code)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Duty analysis failed: {str(e)}")


@app.post("/api/v1/letter-builder/generate-letter")
async def generate_letter_endpoint(
    req: LetterGenerationRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Assemble the final employment letter from user-approved data.
    Requires a letter_builder credit."""
    ensure_user_exists(user_id, db)
    
    # Check access: Complete tier gets unlimited, otherwise need credits
    user = db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
    has_tier_access = user and user.subscription_tier == 'complete'
    if not has_tier_access:
        if not user or user.letter_builder_credits <= 0:
            raise HTTPException(status_code=403, detail="No Letter Builder credits available. Please upgrade to Complete or purchase a credit.")
        # Only deduct credits for non-tier users
        user.letter_builder_credits -= 1
    
    try:
        result = ai_service.assemble_letter_text(
            employment_details=req.employment_details.model_dump(),
            noc_code=req.noc_code,
            noc_title=req.noc_title,
            approved_duties=[d.model_dump() for d in req.approved_duties]
        )
        
        # Save to evaluations table
        record = db_models.Evaluation(
            evaluation_type='letter_builder',
            user_id=user_id,
            document_type="Letter Builder",
            role_name=req.employment_details.job_title,
            company_name=req.employment_details.company_name,
            original_filename=None,
            stored_file_id=str(uuid.uuid4()),
            compliance_status=result.get("status", "APPROVED"),
            is_premium_unlocked=1,
            payload={
                **result,
                "employment_details": req.employment_details.model_dump(),
                "approved_duties": [d.model_dump() for d in req.approved_duties],
                "noc_code": req.noc_code,
                "noc_title": req.noc_title,
            },
        )
        db.add(record)
        db.commit()
        
        return result
    except Exception as e:
        db.rollback()
        # Refund credit on error
        user.letter_builder_credits += 1
        db.commit()
        raise HTTPException(status_code=500, detail=f"Letter generation failed: {str(e)}")


# --- Monetization / Stripe Endpoints ---

@app.get("/api/v1/user/credits")
def get_user_credits(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Fetch user credit balance."""
    user = db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
    if not user:
        return {"find_noc_credits": 0, "audit_letter_credits": 0, "ita_strategy_credits": 0, "profile_builder_credits": 0}
    return {
        "find_noc_credits": user.find_noc_credits,
        "audit_letter_credits": user.audit_letter_credits,
        "letter_builder_credits": user.letter_builder_credits,
        "ita_strategy_credits": user.ita_strategy_credits,
        "profile_builder_credits": user.profile_builder_credits,
        "subscription_tier": user.subscription_tier or "free"
    }

@app.post("/api/v1/dev/grant-credits")
def dev_grant_credits(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """LOCAL DEV ONLY — grants 5 test credits of each type to the current user."""
    if not DEV_CACHE_MODE:
        raise HTTPException(status_code=404, detail="Not found")
    user = db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
    if not user:
        user = db_models.UserAccount(user_id=user_id, find_noc_credits=0, audit_letter_credits=0)
        db.add(user)
    user.find_noc_credits += 5
    user.audit_letter_credits += 5
    user.letter_builder_credits += 5
    user.ita_strategy_credits += 5
    user.profile_builder_credits += 100
    db.commit()
    return {
        "status": "granted",
        "user_id": user_id,
        "find_noc_credits": user.find_noc_credits,
        "audit_letter_credits": user.audit_letter_credits,
        "letter_builder_credits": user.letter_builder_credits,
        "ita_strategy_credits": user.ita_strategy_credits,
        "profile_builder_credits": user.profile_builder_credits
    }

class CheckoutRequest(BaseModel):
    pass_type: str # 'finder' or 'auditor'
    return_path: Optional[str] = None
    return_url: Optional[str] = None

@app.post("/api/v1/create-checkout-session")
def create_checkout_session(
    req: CheckoutRequest,
    user_id: str = Depends(get_current_user),
):
    """Create a Stripe checkout session mapping the user strictly to a credit package."""
    # Ensure user row exists before logging payment events (FK constraint)
    checkout_db = database.SessionLocal()
    try:
        ensure_user_exists(user_id, checkout_db)
    finally:
        checkout_db.close()
    if req.pass_type == 'auditor':
        # 24.90 CAD
        amount = 2490
        name = "Employment Letter Audit (1 Use)"
    elif req.pass_type == 'letter_builder':
        # 14.90 CAD
        amount = 1490
        name = "Interactive Letter Builder (1 Use)"
    elif req.pass_type == 'ita_strategy':
        # 19.90 CAD
        amount = 1990
        name = "Personalized ITA Strategy Report (1 Use)"
    elif req.pass_type == 'war_room':
        # 19.00 CAD
        amount = 1900
        name = "CRS Point Simulator & Draw Matcher Unlock"
    elif req.pass_type == 'starter':
        # 49.00 CAD — Optimize tier
        amount = 4900
        name = "Mentor Visa Optimize — Employment Audits + CRS Simulator"
    elif req.pass_type == 'complete':
        # Check if user is upgrading from Starter → pay only the difference
        upgrade_db = database.SessionLocal()
        try:
            existing_user = upgrade_db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
            if existing_user and existing_user.subscription_tier == 'starter':
                # Differential upgrade: $99 - $49 = $50
                amount = 5000
                name = "Mentor Visa Execute Upgrade (from Optimize)"
            else:
                amount = 9900
                name = "Mentor Visa Execute — All Tools + AI Assistant"
        finally:
            upgrade_db.close()
    else:
        # NOC Finder is free for signed-in users — this path shouldn't be hit anymore
        amount = 0
        name = "NOC Finder Pass (1 Use)"

    try:
        success_url = f"{req.return_url}?payment_success=true" if req.return_url else f"{FRONTEND_URL}{req.return_path}?payment_success=true" if req.return_path else f"{FRONTEND_URL}/dashboard?payment_success=true"
        cancel_url = f"{req.return_url}?payment_canceled=true&session_id={{CHECKOUT_SESSION_ID}}" if req.return_url else f"{FRONTEND_URL}{req.return_path}?payment_canceled=true&session_id={{CHECKOUT_SESSION_ID}}" if req.return_path else f"{FRONTEND_URL}/dashboard?payment_canceled=true&session_id={{CHECKOUT_SESSION_ID}}"

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'cad',
                    'product_data': {
                        'name': name,
                    },
                    'unit_amount': amount,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=success_url,
            cancel_url=cancel_url,
            client_reference_id=user_id, # Safely tie purchase to user explicitly
            metadata={
                "pass_type": req.pass_type
            }
        )
        
        # LOG Payment Initialization
        db = database.SessionLocal()
        try:
            pe = db_models.PaymentEvent(
                user_id=user_id,
                stripe_session_id=session.id,
                event_type='checkout_initiated',
                pass_type=req.pass_type
            )
            db.add(pe)
            db.commit()
        except Exception as log_e:
            print(f"Warning: failed to log payment init: {log_e}")
        finally:
            db.close()
        return {"session_url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe Error: {str(e)}")


from fastapi import Request

@app.post("/api/v1/stripe-webhook")
async def stripe_webhook(request: Request, db: Session = Depends(database.get_db)):
    """Handle Stripe Webhooks anonymously"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except (ValueError, stripe.error.SignatureVerificationError, Exception) as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

    if event.type == 'checkout.session.completed':
        session = event.data.object
        client_user_id = getattr(session, "client_reference_id", None)
        meta = getattr(session, "metadata", {}) or {}
        pass_type = meta.get("pass_type") if isinstance(meta, dict) else getattr(meta, "pass_type", None)
        
        # LOG Payment Success
        pe = db.query(db_models.PaymentEvent).filter_by(stripe_session_id=session.id).first()
        if pe:
            pe.event_type = 'checkout_success'
            db.commit()
        
        if client_user_id:
            user = db.query(db_models.UserAccount).filter_by(user_id=client_user_id).first()
            if not user:
                user = db_models.UserAccount(user_id=client_user_id, find_noc_credits=0, audit_letter_credits=0)
                db.add(user)
            
            if pass_type == 'auditor':
                user.audit_letter_credits += 1
            elif pass_type == 'letter_builder':
                user.letter_builder_credits += 1
            elif pass_type == 'ita_strategy':
                user.ita_strategy_credits += 1
            elif pass_type == 'war_room':
                user.ita_strategy_credits += 1
            elif pass_type == 'starter':
                user.subscription_tier = 'starter'
                # Starter tier includes some credits
                user.audit_letter_credits += 2
                user.ita_strategy_credits += 2
                user.profile_builder_credits += 20  # 20 AI Assistant questions
            elif pass_type == 'complete':
                # Grant differential credits based on whether upgrading from starter
                was_starter = user.subscription_tier == 'starter'
                user.subscription_tier = 'complete'
                if was_starter:
                    # Upgrading from Starter — grant only the difference
                    # Starter gave: 2 audit + 2 strategy + 20 profile builder
                    # Complete total: 5 audit + 3 builder + 5 strategy + unlimited profile builder
                    # Difference: 3 audit + 3 builder + 3 strategy (profile builder is unlimited for complete)
                    user.audit_letter_credits += 3
                    user.letter_builder_credits += 3
                    user.ita_strategy_credits += 3
                else:
                    # Fresh Complete purchase — full credits
                    user.audit_letter_credits += 5
                    user.letter_builder_credits += 3
                    user.ita_strategy_credits += 5
            else:
                user.find_noc_credits += 1
                
            db.commit()

    return {"status": "success"}

class UnlockRequest(BaseModel):
    file_id: str
    pass_type: str # 'finder' or 'auditor'

@app.post("/api/v1/unlock-evaluation")
def unlock_evaluation(
    req: UnlockRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Consume a user's credit to permanently unlock an evaluation result."""
    ensure_user_exists(user_id, db)
    user = db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
    if not user:
        raise HTTPException(status_code=403, detail="No credits available. Please purchase a pass.")
        
    if req.pass_type == 'auditor':
        # Starter and Complete tiers get unlimited audits
        has_tier_access = user.subscription_tier in ('starter', 'complete')
        if not has_tier_access:
            if user.audit_letter_credits <= 0:
                raise HTTPException(status_code=403, detail="No audit credits available. Please upgrade to Starter or purchase a credit.")
            user.audit_letter_credits -= 1
        # Tier users: no credit deduction, just unlock
    elif req.pass_type == 'letter_builder':
        # Complete tier gets unlimited letter builder
        has_tier_access = user.subscription_tier == 'complete'
        if not has_tier_access:
            if user.letter_builder_credits <= 0:
                raise HTTPException(status_code=403, detail="No letter builder credits available. Please upgrade to Complete or purchase a credit.")
            user.letter_builder_credits -= 1
    else:
        if user.find_noc_credits <= 0:
            raise HTTPException(status_code=403, detail="No finder credits available.")
        user.find_noc_credits -= 1

    if req.pass_type == 'auditor':
        records = db.query(db_models.Evaluation).filter_by(evaluation_type='audit', stored_file_id=req.file_id).all()
    else:
        records = db.query(db_models.Evaluation).filter_by(evaluation_type='noc_finder', stored_file_id=req.file_id).all()

    if not records:
        db.rollback()
        raise HTTPException(status_code=404, detail="Evaluation record not found.")

    for record in records:
        # Tie this record permanently to the user if it was anonymous
        if record.user_id == "anonymous":
            record.user_id = user_id
        record.is_premium_unlocked = 1
        
    db.commit()
    
    return {"status": "unlocked", "remaining_finder": user.find_noc_credits, "remaining_auditor": user.audit_letter_credits}


class CancelRequest(BaseModel):
    session_id: str

@app.post("/api/v1/payment-events/cancel")
def cancel_payment_event(req: CancelRequest, db: Session = Depends(database.get_db)):
    """Marks a payment event as canceled gracefully for tracking purposes"""
    pe = db.query(db_models.PaymentEvent).filter_by(stripe_session_id=req.session_id).first()
    if pe and pe.event_type == 'checkout_initiated':
        pe.event_type = 'checkout_returned_unpaid'
        db.commit()
    return {"status": "ok"}


# --- ITA Strategy Report Endpoints ---

class ITAStrategyRequest(BaseModel):
    evaluation_id: int

@app.post("/api/v1/ita-strategy/generate")
def generate_ita_strategy_endpoint(
    req: ITAStrategyRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Generate a personalized ITA strategy report using AI. Requires 1 ita_strategy credit."""
    ensure_user_exists(user_id, db)
    
    # Check credits
    user = db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
    if not user or user.ita_strategy_credits < 1:
        raise HTTPException(status_code=402, detail="No ITA Strategy credits remaining. Please purchase a credit.")
    
    # Fetch the source CRS evaluation
    evaluation = db.query(db_models.Evaluation).filter_by(id=req.evaluation_id, user_id=user_id, evaluation_type='crs_calculator').first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="CRS evaluation not found.")
    
    payload = evaluation.payload or {}
    raw_inputs = payload.get('raw_inputs', {})
    score_data = payload.get('score', {})
    breakdown_data = payload.get('breakdown', {})
    
    if not raw_inputs or not score_data:
        raise HTTPException(status_code=400, detail="CRS evaluation is missing required data.")
    
    try:
        # Generate the strategy via AI
        strategy_report = ai_service.generate_ita_strategy(raw_inputs, score_data, breakdown_data)
        
        # Consume 1 credit
        user.ita_strategy_credits -= 1
        
        # Store the strategy as a new evaluation record linked to the source
        strategy_record = db_models.Evaluation(
            evaluation_type='ita_strategy',
            user_id=user_id,
            document_type='ITA Strategy Report',
            role_name=f"CRS Score: {score_data.get('total', 'N/A')}",
            company_name='Express Entry',
            compliance_status='Generated',
            is_premium_unlocked=1,
            payload={
                'evaluation_type': 'ita_strategy',
                'source_evaluation_id': req.evaluation_id,
                'source_score': score_data,
                'source_raw_inputs': raw_inputs,
                'strategy': strategy_report,
            }
        )
        db.add(strategy_record)
        db.commit()
        db.refresh(strategy_record)
        
        return {
            "success": True,
            "strategy_id": strategy_record.id, 
            "strategy": strategy_report,
            "remaining_credits": user.ita_strategy_credits
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Strategy generation failed: {str(e)}")


@app.get("/api/v1/ita-strategy/{evaluation_id}")
def get_ita_strategy(
    evaluation_id: int,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Retrieve a previously generated ITA strategy report."""
    # Look for ita_strategy records that reference this source evaluation
    strategies = db.query(db_models.Evaluation).filter_by(
        user_id=user_id,
        evaluation_type='ita_strategy'
    ).order_by(db_models.Evaluation.id.desc()).all()
    
    # Find the one linked to this evaluation_id
    for s in strategies:
        payload = s.payload or {}
        if payload.get('source_evaluation_id') == evaluation_id:
            return {
                "success": True,
                "strategy_id": s.id,
                "strategy": payload.get('strategy', {}),
                "generated_at": str(s.timestamp_toronto)
            }
    
    return {"success": False, "strategy": None}


# --- Profile Builder Agent Endpoints ---

import profile_builder_service
from profile_builder_models import ChatRequest, Conversation
from fastapi.responses import StreamingResponse
import asyncio
import base64

# Ensure conversations table exists
Conversation.__table__.create(bind=database.engine, checkfirst=True)


@app.post("/api/v1/profile-builder/chat")
@limiter.limit("120/hour")
async def profile_builder_chat(
    request: Request,
    req: ChatRequest,
    user_id: str = Depends(get_current_user_optional),
    db: Session = Depends(database.get_db)
):
    """Stream a chat response from the Profile Builder AI agent.
    
    Graduated access:
    - Anonymous: 2 questions/day (IP rate limited), no conversation save
    - Free tier: 5 credits (granted on sign-up)
    - Starter tier: 20 credits (granted on purchase)
    - Complete tier: Unlimited
    
    Returns Server-Sent Events (SSE) stream.
    """
    is_anonymous = (user_id == "anonymous")
    user = None
    credits_after = 0
    
    if is_anonymous:
        # Anonymous: IP rate limit handles gating (2/day set above via limiter)
        # No credit deduction, no DB save
        credits_after = 0  # Signals "sign in for more" to frontend
    else:
        ensure_user_exists(user_id, db)
        user = db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
        
        if user and user.subscription_tier == 'complete':
            # Complete tier: unlimited
            credits_after = -1  # -1 signals "unlimited" to frontend
        elif user and user.profile_builder_credits > 0:
            # Free or Starter tier with credits remaining: deduct 1
            user.profile_builder_credits -= 1
            credits_after = user.profile_builder_credits
            db.commit()
        else:
            # No credits remaining — tell frontend which tier to upgrade to
            current_tier = user.subscription_tier if user else 'free'
            upgrade_to = 'starter' if current_tier == 'free' else 'complete'
            raise HTTPException(
                status_code=403,
                detail=json.dumps({
                    "code": "credits_exhausted",
                    "current_tier": current_tier,
                    "upgrade_to": upgrade_to,
                    "message": f"No AI Assistant credits remaining. Upgrade to {upgrade_to} for more."
                })
            )
    
    # 4. Handle image in latest message (upload to Supabase Storage)
    image_data = None
    image_mime = None
    latest_msg = req.messages[-1] if req.messages else None
    image_url_for_storage = None
    
    if latest_msg and latest_msg.image_data:
        try:
            # Decode base64 image
            # Handle data URL format: "data:image/png;base64,xxxxx"
            b64_str = latest_msg.image_data
            if "," in b64_str:
                header, b64_str = b64_str.split(",", 1)
                # Extract MIME from header like "data:image/png;base64"
                image_mime = header.split(":")[1].split(";")[0] if ":" in header else "image/png"
            else:
                image_mime = "image/png"
            
            image_data = base64.b64decode(b64_str)
            
            # Upload to Supabase Storage (or save locally)
            ext_map = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
            ext = ext_map.get(image_mime, ".png")
            img_file_id = str(uuid.uuid4())
            stored_name = f"chat-images/{img_file_id}{ext}"
            
            if supabase:
                supabase.storage.from_("documents").upload(
                    path=stored_name,
                    file=image_data,
                    file_options={"content-type": image_mime}
                )
                # Get a signed URL for storage reference
                image_url_for_storage = stored_name
            else:
                # Local dev: save to uploads dir
                chat_img_dir = UPLOADS_DIR / "chat-images"
                chat_img_dir.mkdir(exist_ok=True)
                with open(chat_img_dir / f"{img_file_id}{ext}", "wb") as f:
                    f.write(image_data)
                image_url_for_storage = stored_name
                
        except Exception as img_err:
            print(f"Warning: failed to process chat image: {img_err}")
            image_data = None
            image_mime = None
    
    # 5. Build user context from journey data (skip for anonymous)
    user_context = ""
    if not is_anonymous:
        journey = db.query(journey_models.PRJourney).filter_by(user_id=user_id).first()
        journey_dict = {}
        profile_dict = {}
        if journey:
            journey_dict = {
                "noc_code": journey.noc_code,
                "noc_title": journey.noc_title,
                "teer_category": journey.teer_category,
                "crs_score": journey.crs_score,
                "crs_calculated_at": journey.crs_calculated_at.isoformat() if journey.crs_calculated_at else None,
                "eligible_programs": journey.eligible_programs,
            }
            profile_dict = journey.profile_data or {}
        user_context = profile_builder_service.build_user_context(journey_dict, profile_dict)
    
    # 6. Prepare messages for LLM (prune history)
    msg_dicts = [{"role": m.role, "content": m.content, "image_url": m.image_data} for m in req.messages]
    # Replace latest message's image_data with the storage URL
    if image_url_for_storage and msg_dicts:
        msg_dicts[-1]["image_url"] = image_url_for_storage
    
    pruned = profile_builder_service.prepare_messages_for_llm(msg_dicts)
    
    # 7. Stream response
    conversation_id = req.conversation_id or str(uuid.uuid4())
    assistant_content = []  # Accumulate for persistence
    credit_refunded = False
    
    async def event_stream():
        nonlocal credit_refunded
        try:
            first_chunk = True
            async for chunk in profile_builder_service.stream_chat_response(
                messages=pruned,
                user_context=user_context,
                image_data=image_data,
                image_mime=image_mime,
            ):
                first_chunk = False
                assistant_content.append(chunk)
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
            
            # Send completion event with metadata
            yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'credits_remaining': credits_after})}\n\n"
            
        except Exception as stream_err:
            print(f"Profile Builder stream error: {stream_err}")
            # Refund credit if we deducted one (non-anonymous, non-complete)
            if not is_anonymous and user and user.subscription_tier != 'complete':
                try:
                    refund_db = database.SessionLocal()
                    refund_user = refund_db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
                    if refund_user:
                        refund_user.profile_builder_credits += 1
                        refund_db.commit()
                        credit_refunded = True
                    refund_db.close()
                except Exception as refund_err:
                    print(f"Warning: failed to refund credit: {refund_err}")
            
            yield f"data: {json.dumps({'type': 'error', 'message': str(stream_err), 'credit_refunded': credit_refunded})}\n\n"
        finally:
            # Save conversation to DB (skip for anonymous users)
            if is_anonymous:
                return
            try:
                save_db = database.SessionLocal()
                full_assistant_text = "".join(assistant_content)
                
                # Build the message list for storage (no base64 — only URLs)
                stored_messages = []
                for m in req.messages:
                    stored_msg = {"role": m.role, "content": m.content}
                    if m == latest_msg and image_url_for_storage:
                        stored_msg["image_url"] = image_url_for_storage
                    stored_messages.append(stored_msg)
                
                # Add assistant response
                if full_assistant_text:
                    stored_messages.append({"role": "assistant", "content": full_assistant_text})
                
                # Upsert conversation
                existing = save_db.query(Conversation).filter_by(conversation_id=conversation_id).first()
                if existing:
                    existing.messages = stored_messages
                    existing.updated_at = datetime.datetime.utcnow()
                else:
                    # Auto-title from first user message
                    first_user_msg = next((m.content for m in req.messages if m.role == "user"), "New conversation")
                    title = first_user_msg[:80] + ("..." if len(first_user_msg) > 80 else "")
                    
                    new_convo = Conversation(
                        conversation_id=conversation_id,
                        user_id=user_id,
                        title=title,
                        messages=stored_messages,
                    )
                    save_db.add(new_convo)
                
                save_db.commit()
                save_db.close()
            except Exception as save_err:
                print(f"Warning: failed to save conversation: {save_err}")
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@app.get("/api/v1/profile-builder/conversations")
def list_profile_builder_conversations(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """List the user's past Profile Builder conversations."""
    convos = (
        db.query(Conversation)
        .filter_by(user_id=user_id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return {
        "conversations": [
            {
                "conversation_id": c.conversation_id,
                "title": c.title or "Untitled",
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in convos
        ]
    }


@app.get("/api/v1/profile-builder/conversations/{conversation_id}")
def get_profile_builder_conversation(
    conversation_id: str,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Load a specific conversation's full message history."""
    convo = db.query(Conversation).filter_by(
        conversation_id=conversation_id,
        user_id=user_id
    ).first()
    
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    
    return {
        "conversation_id": convo.conversation_id,
        "title": convo.title,
        "messages": convo.messages or [],
        "created_at": convo.created_at.isoformat() if convo.created_at else None,
        "updated_at": convo.updated_at.isoformat() if convo.updated_at else None,
    }
