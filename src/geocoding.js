async function geocodeAddress(address) {
  try {
    const uri = `${process.env.GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${process.env.GEOCODE_API_KEY}`
    const res = await fetch(uri).then(res => res.json());
    
    if (res?.status !== "OK") return null;
    return res.results[0].geometry.location;
  } catch (error) {
    return null;
  }
}

module.exports = { geocodeAddress };