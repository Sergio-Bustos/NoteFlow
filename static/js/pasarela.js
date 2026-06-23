    // Lee plan y precio de la URL
    const params  = new URLSearchParams(window.location.search);
    const plan    = params.get('plan')    || 'mensual';
    const precio  = params.get('precio')  || '24900';

    const nombres = { quincenal: 'Quincenal · 15 días', mensual: 'Mensual · 30 días', anual: 'Anual · 1 año' };
    document.getElementById('display-plan').textContent = nombres[plan] || plan;
    document.getElementById('btn-precio').textContent   = '$ ' + Number(precio).toLocaleString('es-CO') + ' COP';

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
    let metodoSeleccionado = null;

    function seleccionarMetodo(el, nombre) {
        document.querySelectorAll('.metodo-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        metodoSeleccionado = nombre;
    }

    function formatCard(input) {
        let v = input.value.replace(/\D/g, '').substring(0, 16);
        input.value = v.replace(/(.{4})/g, '$1 ').trim();
    }

    function formatExpiry(input) {
        let v = input.value.replace(/\D/g, '').substring(0, 4);
        if (v.length >= 3) v = v.substring(0,2) + '/' + v.substring(2);
        input.value = v;
    }

    function procesarPago(e) {
        e.preventDefault();
        
        const nombre = document.getElementById('nombre').value;
        const correo = document.getElementById('correo').value;
        const numeroTarjeta = document.getElementById('numero-tarjeta').value.replace(/\s/g, '');
        const vencimiento = document.getElementById('vencimiento').value;
        const cvv = document.getElementById('cvv').value;

        if (!nombre || !correo || !numeroTarjeta || !vencimiento || !cvv) {
            alert('Por favor completa todos los campos de la tarjeta.');
            return;
        }

        const btnPagar = document.querySelector('.btn-pagar');
        const btnOriginal = btnPagar.innerHTML;
        btnPagar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
        btnPagar.disabled = true;

        fetch('/procesar-pago', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                plan: plan,
                precio: precio,
                metodo: 'tarjeta',
                nombre: nombre,
                correo: correo,
                numero_tarjeta: numeroTarjeta,
                vencimiento: vencimiento,
                cvv: cvv
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const ultimos4 = numeroTarjeta.slice(-4);
                alert('Pago aprobado. Se usó la tarjeta terminada en ' + ultimos4 + '.\n\nRedirigiendo...');
                window.location.href = data.redirect || '/dashboard';
            } else {
                alert(data.error || 'Error al procesar el pago');
                btnPagar.innerHTML = btnOriginal;
                btnPagar.disabled = false;
            }
        })
        .catch(err => {
            console.error('Error en pago:', err);
            alert('Error de conexión al procesar el pago');
            btnPagar.innerHTML = btnOriginal;
            btnPagar.disabled = false;
        });
    }