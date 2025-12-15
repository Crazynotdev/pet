const endpoint = "https://bot-api.danscot.tech";

function createParticles() {
  const particlesContainer = document.getElementById('particles');
  
  if (!particlesContainer) return;
  
  const colors = ['#c4d82e', '#7fb800', '#d4e157', '#9ccc65', '#8bc34a'];

  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';

    const size = Math.random() * 6 + 2;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    particle.style.animationDelay = Math.random() * 15 + 's';
    particle.style.animationDuration = Math.random() * 10 + 10 + 's';

    particlesContainer.appendChild(particle);
  }
}

async function generateCode(phoneNumber) {
  const req = `/pair?num=${phoneNumber}`;

  try {
    const res = await fetch(endpoint + req, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ num: phoneNumber })
    });

    const data = await res.json();
    console.log("Pair Response:", data);

    if (!res.ok) {
      return "Error pairing number";
    }

    return "CRAZYDEV";

  } catch (err) {
    console.error(err);
    return "Error: " + err.message;
  }
}

// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', function() {
  const pairForm = document.getElementById('pairForm');
  const phoneInput = document.getElementById('phoneNumber');
  const copyBtn = document.getElementById('copyBtn');
  const closeBtn = document.getElementById('closeBtn');
  const modalOverlay = document.getElementById('modalOverlay');
  
  // Vérifier que les éléments existent
  if (!pairForm || !phoneInput || !copyBtn || !closeBtn || !modalOverlay) {
    console.log("Certains éléments ne sont pas trouvés");
    return;
  }

  pairForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const phoneNumber = phoneInput.value.trim();

    if (phoneNumber === "") {
      alert("Please enter a phone number");
      return;
    }

    const code = await generateCode(phoneNumber);
    
    const generatedCodeElement = document.getElementById('generatedCode');
    if (generatedCodeElement) {
      generatedCodeElement.textContent = code;
    }
    
    modalOverlay.classList.add('active');
  });

  copyBtn.addEventListener('click', function () {
    const generatedCodeElement = document.getElementById('generatedCode');
    if (!generatedCodeElement) return;
    
    const code = generatedCodeElement.textContent;
    
    navigator.clipboard.writeText(code).then(function () {
      const btn = document.getElementById('copyBtn');
      if (!btn) return;
      
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      
      setTimeout(() => {
        if (btn) {
          btn.textContent = originalText;
        }
      }, 2000);
    }).catch(function(err) {
      console.error('Erreur de copie:', err);
    });
  });

  closeBtn.addEventListener('click', function () {
    modalOverlay.classList.remove('active');
  });

  modalOverlay.addEventListener('click', function (e) {
    if (e.target === this) {
      this.classList.remove('active');
    }
  });
  
  createParticles();
});
