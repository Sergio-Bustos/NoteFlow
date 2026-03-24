/* ══════════════════════════════════════════
   COMENTARIOS
   Array local con 6 reseñas predefinidas.
   Se asignan en orden a cada usuario retornado
   por la API, por eso deben ser exactamente 6
   (igual que el parámetro results= de la URL).
════════════════════════════════════════════ */
const comentarios = [
  "Excelente servicio, tenía dudas, escribí y me atendieron de buena forma y aclararon todo.",
  "Producto de alta calidad, el editor de imágenes es muy intuitivo.",
  "El editor de audio y video no son competitivos pero el de imágenes sí.",
  "Los precios son muy competitivos y la calidad es top.",
  "Excelente atención al cliente, me ayudaron con todas mis dudas.",
  "Producto de alta calidad, el editor de imágenes es muy intuitivo.",
];


/* ══════════════════════════════════════════
   INICIALIZACIÓN
   Se ejecuta cuando el DOM está listo
════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  // Busca el contenedor del grid de reseñas en el DOM
  const grid = document.getElementById('reviewsGrid');

  // Si no existe el elemento en esta página, no hace nada
  if (!grid) return;

  /**
   * Consulta RandomUser.me pidiendo 6 usuarios de:
   *  - co → Colombia
   *  - mx → México
   *  - es → España
   * Esto le da variedad de nombres hispanohablantes a las reseñas.
   */
  fetch('https://randomuser.me/api/?results=6&nat=co,mx,es')
    .then(r => r.json())
    .then(data => {

      // Limpia el mensaje "Cargando reseñas..." antes de renderizar
      grid.innerHTML = '';

      // Itera cada usuario retornado por la API
      data.results.forEach((user, i) => {

        // Extrae nombre completo y foto del objeto de usuario
        const nombre = `${user.name.first} ${user.name.last}`;
        const foto = user.picture.medium; // Tamaño medium: 64x64px

        // Asigna el comentario correspondiente según el índice
        const comentario = comentarios[i];

        // Crea la tarjeta de reseña
        const card = document.createElement('div');
        card.className = 'review-card';
        card.innerHTML = `
          <div class="review-header">
            <img src="${foto}" alt="${nombre}">
            <div>
              <div class="review-name">${nombre}</div>
              <!-- 5 estrellas fijas para todos los clientes -->
              <div class="review-stars">★★★★★</div>
            </div>
          </div>
          <p class="review-comment">"${comentario}"</p>
        `;

        // Agrega la tarjeta al grid del DOM
        grid.appendChild(card);
      });
    })

    // Si la API no responde, muestra mensaje de error en el grid
    .catch(() => {
      grid.innerHTML = '<p class="loading">No se pudieron cargar las reseñas.</p>';
    });
});