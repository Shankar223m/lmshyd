import importlib, traceback, sys
try:
    import app.main as m
    print('Import success')
except Exception as e:
    traceback.print_exc()
    sys.exit(1)
