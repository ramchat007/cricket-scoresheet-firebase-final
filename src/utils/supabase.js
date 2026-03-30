const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function headers() {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

function buildRpcClient() {
  const rpc = async (fnName, params = {}) => {
    const res = await fetch(`${url}/rest/v1/rpc/${fnName}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      return {
        data: null,
        error: new Error(`Supabase RPC failed (${res.status}) for ${fnName}`),
      };
    }

    const data = await res.json();
    return { data, error: null };
  };

  const from = (table) => ({
    delete() {
      const filters = [];
      return {
        eq(field, value) {
          filters.push(`${encodeURIComponent(field)}=eq.${encodeURIComponent(value)}`);
          return this;
        },
        async then(resolve, reject) {
          const query = filters.length ? `?${filters.join("&")}` : "";
          const res = await fetch(`${url}/rest/v1/${table}${query}`, {
            method: "DELETE",
            headers: headers(),
          });
          if (!res.ok) {
            return reject?.(new Error(`Supabase DELETE failed (${res.status})`));
          }
          return resolve?.({ error: null });
        },
      };
    },
  });

  // Placeholder realtime API compatible with adapter signature.
  const channel = () => ({
    on() {
      return this;
    },
    subscribe() {
      return this;
    },
  });

  const removeChannel = () => {};

  return { rpc, from, channel, removeChannel };
}

export const supabase = url && anonKey ? buildRpcClient() : null;
