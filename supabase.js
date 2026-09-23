// =========================================================
// supabase.js - Conexión a Supabase
// =========================================================

const SUPABASE_URL = "https://kpsurjxypipxtjizlyon.supabase.co";
const SUPABASE_KEY = "sb_publishable_sA8BVuihO3RaIcZrqTPzyA_HkYahfV5";

let supabaseClient = null;
try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.supabaseClient = supabaseClient;
  console.log("✅ Supabase conectado");
} catch (e) {
  console.error("❌ Error Supabase:", e);
}

function normalizarNombre(nombre) {
  return String(nombre)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}