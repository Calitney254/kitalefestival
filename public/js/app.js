const sponsorGrid = document.getElementById('sponsor-grid');
const sponsorForm = document.getElementById('sponsor-form');
const bookingForm = document.getElementById('booking-form');
const registrationForm = document.getElementById('registration-form');
const contactForm = document.getElementById('contact-form');
const ticketTypeSelect = document.getElementById('ticket-type');

async function loadSponsors() {
  const response = await fetch('/api/sponsors');
  const sponsors = await response.json();
  sponsorGrid.innerHTML = sponsors.map((sponsor) => `
    <article class="card">
      <img src="${sponsor.logo_url || 'https://placehold.co/220x120?text=Sponsor'}" alt="${sponsor.name} logo" />
      <h4>${sponsor.name}</h4>
      <p><strong>Tier:</strong> ${sponsor.tier}</p>
      <p>${sponsor.notes || ''}</p>
      ${sponsor.website ? `<a href="${sponsor.website}" target="_blank" rel="noopener noreferrer">Visit Sponsor</a>` : ''}
      <small>Updated: ${new Date(sponsor.updated_at).toLocaleString()}</small>
    </article>
  `).join('');
}

async function loadTicketTypes() {
  const response = await fetch('/api/tickets/types');
  const ticketTypes = await response.json();
  ticketTypeSelect.innerHTML = Object.entries(ticketTypes)
    .map(([key, item]) => `<option value="${key}">${item.name} - KES ${item.price}</option>`)
    .join('');
}

function formDataToJson(form) {
  return Object.fromEntries(new FormData(form).entries());
}

sponsorForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = formDataToJson(sponsorForm);

  const response = await fetch('/api/sponsors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    sponsorForm.reset();
    await loadSponsors();
  }
});

bookingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const resultNode = document.getElementById('booking-result');

  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formDataToJson(bookingForm))
  });

  const data = await response.json();
  resultNode.textContent = response.ok
    ? `${data.message} Reference: ${data.paymentReference}. Total: KES ${data.totalAmount}`
    : data.message;
});

registrationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const resultNode = document.getElementById('registration-result');

  const response = await fetch('/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formDataToJson(registrationForm))
  });

  const data = await response.json();
  resultNode.textContent = data.message;
  if (response.ok) registrationForm.reset();
});

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const resultNode = document.getElementById('contact-result');

  const response = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formDataToJson(contactForm))
  });

  const data = await response.json();
  resultNode.textContent = data.message;
  if (response.ok) contactForm.reset();
});

const menuToggle = document.getElementById('menu-toggle');
const mainNav = document.getElementById('main-nav');
menuToggle.addEventListener('click', () => mainNav.classList.toggle('open'));

document.getElementById('year').textContent = new Date().getFullYear();

loadSponsors();
loadTicketTypes();
setInterval(loadSponsors, 24 * 60 * 60 * 1000);
