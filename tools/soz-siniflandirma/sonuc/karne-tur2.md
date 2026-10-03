# Tur 2 karnesi (olc_hibrit.py)
olc.py 1e5c51482c41f2ea | olc_hibrit.py 15bc79debb6a0f80 | etiketli cf46cbceab2b29fc | τ_H1 = None
Traceback (most recent call last):
  File "C:\Users\ozigo\3dorion\tools\soz-siniflandirma\olc_hibrit.py", line 109, in <module>
    main()
    ~~~~^^
  File "C:\Users\ozigo\3dorion\tools\soz-siniflandirma\olc_hibrit.py", line 70, in main
    assert (k_h["gidenler"], k_h["dogru"]) == (k_b["gidenler"], k_b["dogru"]), ("KONTROL TUTMADI", k_h, k_b)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: ('KONTROL TUTMADI', {'gidenler': 0, 'dogru': 0, 'precision': None, 'coverage': 0.0, 'yanlis': [], 'yol_sozu_sayisi': 23}, {'gidenler': 17, 'dogru': 17, 'precision': 1.0, 'coverage': 0.7391304347826086, 'yanlis': [], 'yol_sozu_sayisi': 23})
