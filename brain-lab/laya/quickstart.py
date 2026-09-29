from laya import Router

router = Router()  # downloads a checkpoint on first use

state = "Hi, we were billed twice for March. Please refund the duplicate today or we will cancel our plan."
questions = {
    "department": {"type": "choice", "instructions": "Which department should handle this?",
                   "criteria": {"billing": "invoices, payments, refunds",
                                "technical": "bugs, outages, system errors",
                                "other": "everything else"}},
    "urgency": {"type": "score", "instructions": "How urgent is this?",
                "criteria": ["not urgent", "soon", "blocking"]},
    "churn_risk": {"type": "noul", "instructions": "Does the user threaten to cancel or leave?"},
}

import time
t0 = time.time()
result = router.predict(state, questions)
dt = time.time() - t0

print("department:", result["answers"]["department"]["choice"])
print("urgency:", result["answers"]["urgency"])
print("churn_risk:", result["answers"]["churn_risk"]["noul"])
print("routing:", result["routing"])
print(f"sure: {dt*1000:.1f} ms")
