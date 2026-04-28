    // Lee plan y precio de la URL
    const params  = new URLSearchParams(window.location.search);
    const plan    = params.get('plan')    || 'mensual';
    const precio  = params.get('precio')  || '24900';

    const nombres = { quincenal: 'Quincenal · 15 días', mensual: 'Mensual · 30 días', anual: 'Anual · 1 año' };
    document.getElementById('display-plan').textContent = nombres[plan] || plan;
    document.getElementById('btn-precio').textContent   = '$ ' + Number(precio).toLocaleString('es-CO') + ' COP';

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
        
        // Configuración de la pasarela ePayco Checkout
        const epaycoKey = document.getElementById('epayco-config').dataset.publicKey;
        var handler = ePayco.checkout.configure({
            key: epaycoKey,
            test: true 
        });

        // Aseguramos que el precio sea puramente numérico
        const amountLimpio = String(precio).replace(/\D/g, '');

        var data = {
            name: "Premium NoteFlow",
            description: "Suscripcion " + plan,
            invoice: "NF-" + Date.now(),
            currency: "cop",
            amount: amountLimpio,
            tax_base: "0",
            tax: "0",
            country: "co",
            lang: "es",
            name_billing: nombre,
            email_billing: correo,
            external: "true",
            extra1: "1", 
            extra2: plan,
            response: window.location.origin + "/dashboard", 
            confirmation: window.location.origin + "/epayco/webhook",
        };

        handler.open(data);
    }