import time
from laya import Router

t0 = time.time()
router = Router()
print(f"yukleme: {(time.time()-t0)*1000:.0f} ms")

try:
    import torch
    print("cuda var mi:", torch.cuda.is_available())
except Exception as e:
    print("torch kontrolu basarisiz:", e)

state = "Hi, we were billed twice for March. Please refund the duplicate today or we will cancel our plan."
questions = {
    "department": {"type": "choice", "instructions": "Which department should handle this?",
                   "criteria": {"billing": "invoices, payments, refunds",
                                "technical": "bugs, outages, system errors",
                                "other": "everything else"}},
}

# ISINMA turu (ilk cagri her zaman biraz yavastir - kernel derleme vb.)
router.predict(state, questions)

sureler = []
for i in range(10):
    t0 = time.time()
    router.predict(state, questions)
    sureler.append((time.time() - t0) * 1000)

print("10 SICAK cagri (ms):", [f"{s:.1f}" for s in sureler])
print(f"ortalama: {sum(sureler)/len(sureler):.1f} ms")
