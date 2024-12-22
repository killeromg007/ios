import os
import shutil
from pathlib import Path

def build():
    # Create build directory
    build_dir = Path("build")
    if build_dir.exists():
        shutil.rmtree(build_dir)
    build_dir.mkdir()

    # Copy static files
    static_dir = build_dir / "static"
    shutil.copytree("static", static_dir)

    # Copy templates
    templates_dir = build_dir / "templates"
    shutil.copytree("templates", templates_dir)

    # Copy Python files
    shutil.copy("app.py", build_dir / "app.py")
    
    # Create requirements.txt in build directory
    shutil.copy("requirements.txt", build_dir / "requirements.txt")

    # Create _routes.py for Cloudflare Pages
    with open(build_dir / "_routes.py", "w") as f:
        f.write("""
from flask import Flask
from app import app as flask_app

app = flask_app
        """)

if __name__ == "__main__":
    build()
