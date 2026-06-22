// UX micro-interactions: scroll reveal, hero parallax, logo float
(function(){
  // Scroll reveal
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function initReveal(){
    if(prefersReduced) return document.querySelectorAll('.reveal').forEach(el=>el.classList.add('show'));
    const obs = new IntersectionObserver((entries, o)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){ e.target.classList.add('show'); o.unobserve(e.target); }
      });
    }, {threshold: 0.12});
    document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
  }

  // Hero parallax (subtle) — responds to mouse move and scroll
  function initParallax(){
    const hero = document.querySelector('.hero');
    const heroImg = document.querySelector('.hero-image');
    if(!hero || !heroImg || prefersReduced) return;
    let mx = 0, my = 0, tx = 0, ty = 0;
    function onMove(e){
      const r = hero.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width - 0.5) * 2; // -1..1
      const py = ((e.clientY - r.top) / r.height - 0.5) * 2;
      mx = px * 6; my = py * 6;
    }
    function onScroll(){
      const st = window.scrollY || window.pageYOffset;
      heroImg.style.transform = `translateY(${Math.min(0, -st * 0.02)}px)`;
    }
    function raf(){ tx += (mx - tx) * 0.08; ty += (my - ty) * 0.08; heroImg.style.transform = `translate3d(${tx}px, ${ty - (window.scrollY||0) * 0.02}px, 0) scale(1.01)`; requestAnimationFrame(raf); }
    hero.addEventListener('mousemove', onMove);
    window.addEventListener('scroll', onScroll, {passive:true});
    requestAnimationFrame(raf);
  }

  // Logo small float for premium feel
  function initLogo(){
    const logo = document.querySelector('.logo.animated');
    if(!logo) return; // CSS handles float; additional subtle transform on hover
    logo.addEventListener('mouseenter', ()=>logo.style.transform='translateY(-3px)');
    logo.addEventListener('mouseleave', ()=>logo.style.transform='translateY(0)');
  }

  document.addEventListener('DOMContentLoaded', ()=>{ initReveal(); initParallax(); initLogo(); });
})();
