

class TestRutasPublicas:
    def test_landing_page(self, client):
        response = client.get("/")
        assert response.status_code in (200, 302)

    def test_features_page(self, client):
        response = client.get("/caracteristicas.html")
        assert response.status_code in (200, 302)

    def test_login_page(self, client):
        response = client.get("/iniciarsesion.html")
        assert response.status_code in (200, 302)

    def test_registro_page(self, client):
        response = client.get("/registro.html")
        assert response.status_code in (200, 302)

    def test_forgot_password_page(self, client):
        response = client.get("/olvide-contrasena")
        assert response.status_code in (200, 302)

    def test_404_page(self, client):
        response = client.get("/ruta-que-no-existe")
        assert response.status_code == 404

    def test_planes_page(self, client):
        with client.session_transaction() as sess:
            sess["usuario_id"] = 1
            sess["usuario_actual"] = "test"
        response = client.get("/planes")
        assert response.status_code in (200, 302)


class TestRutasProtegidas:
    def test_dashboard_sin_sesion_redirige(self, client):
        response = client.get("/dashboard")
        assert response.status_code == 302

    def test_notas_sin_sesion_redirige(self, client):
        response = client.get("/notas")
        assert response.status_code == 302

    def test_perfil_sin_sesion_redirige(self, client):
        response = client.get("/perfil")
        assert response.status_code == 302

    def test_papelera_sin_sesion_redirige(self, client):
        response = client.get("/papelera")
        assert response.status_code == 302


class TestAPIRoutes:
    def test_api_estadisticas_sin_sesion(self, client):
        response = client.get("/api/admin/estadisticas")
        assert response.status_code == 302

    def test_api_usuarios_sin_sesion(self, client):
        response = client.get("/api/admin/usuarios")
        assert response.status_code == 302

    def test_api_mis_notas_sin_sesion(self, client):
        response = client.get("/api/mis-notas")
        assert response.status_code == 302
