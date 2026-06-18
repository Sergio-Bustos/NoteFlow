def test_session_cookie_secure_dev(app):
    assert app.config["SESSION_COOKIE_SECURE"] is False


def test_session_cookie_httponly(app):
    assert app.config["SESSION_COOKIE_HTTPONLY"] is True


def test_session_cookie_samesite(app):
    assert app.config["SESSION_COOKIE_SAMESITE"] == "Lax"


def test_max_content_length(app):
    assert app.config["MAX_CONTENT_LENGTH"] == 2 * 1024 * 1024 * 1024


def test_csrf_enabled(app):
    assert app.config["WTF_CSRF_CHECK_DEFAULT"] is True


def test_static_folder(app):
    assert app.static_folder.endswith("static")


def test_secret_key_set(app):
    assert app.secret_key is not None
    assert len(app.secret_key) > 0
