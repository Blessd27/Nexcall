/* ===================================================
   NexCall — Landing Page Logic
=================================================== */

export function initLanding({ showView, state, threeLanding }) {
  
  // Nav buttons
  const navStartBtn = document.getElementById('nav-start-btn');
  const navFeaturesBtn = document.getElementById('nav-features-btn');
  const heroCreateBtn = document.getElementById('hero-create-btn');
  const heroJoinBtn = document.getElementById('hero-join-btn');

  function goToLobby(tab = 'create') {
    showView('view-lobby');
    // Set active tab
    setTimeout(() => {
      const tabBtn = document.getElementById(`tab-${tab}`);
      if (tabBtn) tabBtn.click();
    }, 50);
  }

  navStartBtn?.addEventListener('click', () => goToLobby('create'));
  heroCreateBtn?.addEventListener('click', () => goToLobby('create'));
  heroJoinBtn?.addEventListener('click', () => goToLobby('join'));

  navFeaturesBtn?.addEventListener('click', () => {
    const features = document.getElementById('features');
    features?.scrollIntoView({ behavior: 'smooth' });
  });

  // 3D Tilt effect on feature cards
  const tiltCards = document.querySelectorAll('.tilt-card');

  tiltCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);

      const tiltX = -dy * 12;
      const tiltY = dx * 12;

      card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(8px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0)';
    });
  });

  // Animated number counters in stats
  animateStats();

  // Scroll reveal for feature cards
  observeCards();
}

function animateStats() {
  // The numbers are static text but we can add a shimmer
  const statNums = document.querySelectorAll('.stat-num');
  statNums.forEach((el, i) => {
    el.style.animationDelay = `${i * 0.1}s`;
    el.style.animation = 'fadeDown 0.6s ease both';
  });
}

function observeCards() {
  if (!('IntersectionObserver' in window)) return;

  const cards = document.querySelectorAll('.feature-card');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          entry.target.style.animationDelay = `${i * 0.08}s`;
          entry.target.style.animation = 'fadeDown 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both';
          entry.target.style.opacity = '1';
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  cards.forEach(card => {
    card.style.opacity = '0';
    observer.observe(card);
  });
}
