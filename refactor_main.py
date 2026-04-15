import re

with open("main.py", "r", encoding="utf-8") as f:
    text = f.read()

# 1. UPSERT logic parsing: Model = db_models.NocEvaluationRecord if is_noc else db_models.AuditEvaluationRecord
text = text.replace(
    "Model = db_models.NocEvaluationRecord if is_noc else db_models.AuditEvaluationRecord",
    "Model = db_models.Evaluation\n            eval_type = 'noc_finder' if is_noc else 'audit'"
)
text = text.replace(
    "existing = db.query(Model).filter_by(stored_file_id=stored_file_id).first()",
    "existing = db.query(Model).filter_by(stored_file_id=stored_file_id, evaluation_type=eval_type).first()"
)

# 2. Replaces creations of NocEvaluationRecord
text = text.replace(
    "db_models.NocEvaluationRecord(",
    "db_models.Evaluation(\n                evaluation_type='noc_finder',"
)

# 3. Replaces creations of AuditEvaluationRecord 
text = text.replace(
    "db_models.AuditEvaluationRecord(",
    "db_models.Evaluation(\n                evaluation_type='audit',"
)

# 4. Queries replacements
text = text.replace(
    "db.query(db_models.AuditEvaluationRecord).filter_by(stored_file_id=req.file_id).all()",
    "db.query(db_models.Evaluation).filter_by(evaluation_type='audit', stored_file_id=req.file_id).all()"
)
text = text.replace(
    "db.query(db_models.NocEvaluationRecord).filter_by(stored_file_id=req.file_id).all()",
    "db.query(db_models.Evaluation).filter_by(evaluation_type='noc_finder', stored_file_id=req.file_id).all()"
)

text = text.replace(
    "db.query(db_models.AuditEvaluationRecord).filter(\n        db_models.AuditEvaluationRecord.user_id == user_id\n    ).all()",
    "db.query(db_models.Evaluation).filter_by(evaluation_type='audit', user_id=user_id).all()"
)
text = text.replace(
    "db.query(db_models.NocEvaluationRecord).filter(\n        db_models.NocEvaluationRecord.user_id == user_id\n    ).all()",
    "db.query(db_models.Evaluation).filter_by(evaluation_type='noc_finder', user_id=user_id).all()"
)

text = text.replace(
    "db.query(db_models.AuditEvaluationRecord).filter(\n        db_models.AuditEvaluationRecord.user_id == user_id,\n        db_models.AuditEvaluationRecord.stored_file_id == file_id\n    ).first()",
    "db.query(db_models.Evaluation).filter(\n        db_models.Evaluation.evaluation_type == 'audit',\n        db_models.Evaluation.user_id == user_id,\n        db_models.Evaluation.stored_file_id == file_id\n    ).first()"
)
text = text.replace(
    "db.query(db_models.NocEvaluationRecord).filter(\n            db_models.NocEvaluationRecord.user_id == user_id,\n            db_models.NocEvaluationRecord.stored_file_id == file_id\n        ).first()",
    "db.query(db_models.Evaluation).filter(\n            db_models.Evaluation.evaluation_type == 'noc_finder',\n            db_models.Evaluation.user_id == user_id,\n            db_models.Evaluation.stored_file_id == file_id\n        ).first()"
)

text = text.replace(
    "db.query(db_models.AuditEvaluationRecord).filter(\n        db_models.AuditEvaluationRecord.stored_file_id == req.file_id\n    ).first()",
    "db.query(db_models.Evaluation).filter_by(evaluation_type='audit', stored_file_id=req.file_id).first()"
)
text = text.replace(
    "db.query(db_models.NocEvaluationRecord).filter(\n            db_models.NocEvaluationRecord.stored_file_id == req.file_id\n        ).first()",
    "db.query(db_models.Evaluation).filter_by(evaluation_type='noc_finder', stored_file_id=req.file_id).first()"
)

# 5. Timestamp fix in get_evaluations
text = text.replace(
    "\"timestamp\": r.timestamp.replace(tzinfo=None) if r.timestamp else None, # ensuring it's treated as naive",
    "\"timestamp\": (r.timestamp_utc.isoformat() + 'Z') if r.timestamp_utc else None,"
)
text = text.replace(
    "result.sort(key=lambda x: x[\"timestamp\"] or datetime.datetime.min, reverse=True)",
    "result.sort(key=lambda x: x[\"timestamp\"] or '', reverse=True)"
)
# Remove the isoformat loop at the end of get_evaluations because we already formatted it
text = re.sub(r'# stringify timestamp for json\s+for r in result:\s+if r\["timestamp"\]:\s+r\["timestamp"\] = r\["timestamp"\].isoformat\(\)', '', text)

# 6. Payment tracking endpoints and Checkout manipulation
stripe_session_block = '''session = stripe.checkout.Session.create(
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
            success_url=f"{FRONTEND_URL}{req.return_path}?payment_success=true" if req.return_path else f"{FRONTEND_URL}/dashboard?payment_success=true",
            cancel_url=f"{FRONTEND_URL}{req.return_path}?payment_canceled=true" if req.return_path else f"{FRONTEND_URL}/dashboard?payment_canceled=true",
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
            db.close()'''

text = text.replace("session = stripe.checkout.Session.create(", stripe_session_block.split("session = stripe.checkout.Session.create(")[0] + "session = stripe.checkout.Session.create(") # Wait, my string above is self contained.
text = re.sub(
    r"session = stripe\.checkout\.Session\.create\(.*?metadata=\{[\s\n]*\"pass_type\": req\.pass_type[\s\n]*\}[\s\n]*\)",
    stripe_session_block,
    text,
    flags=re.DOTALL
)

webhook_block = '''if event.type == 'checkout.session.completed':
        session = event.data.object
        client_user_id = getattr(session, "client_reference_id", None)
        meta = getattr(session, "metadata", {}) or {}
        pass_type = meta.get("pass_type") if isinstance(meta, dict) else getattr(meta, "pass_type", None)
        
        # LOG Payment Success
        pe = db.query(db_models.PaymentEvent).filter_by(stripe_session_id=session.id).first()
        if pe:
            pe.event_type = 'checkout_success'
            db.commit()
        
        if client_user_id:'''

text = text.replace(
    "if event.type == 'checkout.session.completed':\n        session = event.data.object\n        client_user_id = getattr(session, \"client_reference_id\", None)\n        meta = getattr(session, \"metadata\", {}) or {}\n        pass_type = meta.get(\"pass_type\") if isinstance(meta, dict) else getattr(meta, \"pass_type\", None)\n        \n        if client_user_id:",
    webhook_block
)

# Cancel endpoint
cancel_endpoint = '''
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
'''
text += cancel_endpoint

with open("main.py", "w", encoding="utf-8") as f:
    f.write(text)

print("done")
