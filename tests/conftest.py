import os
import sys

os.environ["FLASK_ENV"] = "development"
os.environ["DB_PASSWORD"] = "test-password"
os.environ["SUPABASE_URL"] = "https://test.supabase.co"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role-key"
os.environ["GOOGLE_CLIENT_ID"] = "test-client-id.apps.googleusercontent.com"
os.environ["GOOGLE_CLIENT_SECRET"] = "test-client-secret"
os.environ["FLASK_SECRET_KEY"] = "test-secret-key-for-testing"
os.environ["GOOGLE_REFRESH_TOKEN"] = "test-refresh-token"
os.environ["GMAIL_SENDER"] = "test@noteflow.com"
os.environ["ADMIN_EMAIL"] = "admin@noteflow.com"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from app import app as flask_app


@pytest.fixture
def app():
    flask_app.config["TESTING"] = True
    flask_app.config["WTF_CSRF_ENABLED"] = False
    return flask_app


@pytest.fixture
def client(app):
    return app.test_client()
