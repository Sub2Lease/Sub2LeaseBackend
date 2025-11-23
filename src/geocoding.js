async function geocodeAddress(address) {
  const uri = `${process.env.GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${process.env.GEOCODE_API_KEY}`
  const res = await fetch(uri).then(res => res.json());
  if (res?.status !== "OK") return null;
  return res.results[0].geometry.location;
}

module.exports = { geocodeAddress };