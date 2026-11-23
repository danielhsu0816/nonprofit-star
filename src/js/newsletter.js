// Newsletter page: the city picker moves the Google map and the "Open in Google Maps" link.
const pick = document.getElementById('city-pick');
const box = document.getElementById('az-map');
pick?.addEventListener('change', () => {
  const place = `${pick.value}, AZ`;
  const frame = box.querySelector('iframe');
  frame.src = box.dataset.base + encodeURIComponent(place);
  frame.title = `Google map of ${place}`;
  const a = document.getElementById('gmaps');
  a.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
  a.textContent = `Open ${pick.value} in Google Maps`;
});
