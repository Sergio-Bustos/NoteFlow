from conftest import flask_app


def test_sanitizar_html_elimina_script():
    from app import sanitizar_html
    resultado = sanitizar_html('<script>alert("xss")</script><p>Hola</p>')
    assert "<script>" not in resultado
    assert "<p>Hola</p>" in resultado or "Hola" in resultado


def test_sanitizar_html_permite_basico():
    from app import sanitizar_html
    resultado = sanitizar_html('<strong>Negrita</strong><em>Italica</em>')
    assert "<strong>Negrita</strong>" in resultado or "Negrita" in resultado


def test_sanitizar_html_con_none():
    from app import sanitizar_html
    assert sanitizar_html(None) == ""


def test_sanitizar_html_con_vacio():
    from app import sanitizar_html
    assert sanitizar_html("") == ""


def test_sanitizar_html_elimina_onclick():
    from app import sanitizar_html
    resultado = sanitizar_html('<p onclick="evil()">Click me</p>')
    assert "onclick" not in resultado


def test_construir_email_html_incluye_titulo():
    from app import construir_email_html
    html = construir_email_html("Test Title", "<p>Cuerpo</p>")
    assert "Test Title" in html
    assert "<p>Cuerpo</p>" in html
    assert "NoteFlow" in html


def test_construir_email_html_con_cuerpo_vacio():
    from app import construir_email_html
    html = construir_email_html("Solo titulo", "")
    assert "Solo titulo" in html
