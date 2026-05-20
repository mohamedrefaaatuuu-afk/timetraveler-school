import os
import glob
import sys

REDIRECT = '<script>(function(){var h=window.location.hash;if(h==="#/schools"||h===""||h==="#/"||h==="#"){window.location.replace("/#/login");}})()</script>'

print("=== dist/ HTML files ===")
files = glob.glob("dist/**/*.html", recursive=True) + glob.glob("dist/*.html")
for f in files:
    print(f)

if not files:
    print("ERROR: No HTML files found in dist/")
    sys.exit(1)

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'window.location.replace' in content:
        print("Already patched:", filepath)
        continue
    if '<script type="module"' in content:
        content = content.replace('<script type="module"', REDIRECT + '\n    <script type="module"', 1)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Patched:", filepath)
    else:
        print("No module script in:", filepath)
