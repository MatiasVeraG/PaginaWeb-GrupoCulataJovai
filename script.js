// Animación de aparición al hacer scroll
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('section').forEach(section => {
        section.classList.add('fade-in');
    });
    document.querySelectorAll('.fade-in, .reveal').forEach(el => observer.observe(el));
});

// Sombra del encabezado al hacer scroll
const header = document.getElementById('header');

if (header) {
    window.addEventListener('scroll', () => {
        header.style.boxShadow = window.pageYOffset > 100 ? '0 2px 10px rgba(0, 0, 0, 0.05)' : 'none';
    });
}
