(() => {
  "use strict";

  const storageKey = "poke-savings-cardtrader-lists-v1";

  function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function readLists() {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return {};
    const lists = JSON.parse(raw);
    if (!lists || typeof lists !== "object" || Array.isArray(lists)) {
      throw new Error("Le wishlist salvate non sono leggibili.");
    }
    return lists;
  }

  function readWishlist(data) {
    if (!data || !Number.isSafeInteger(data.id) || data.id <= 0 ||
        typeof data.name !== "string" || !data.name.trim() ||
        !Array.isArray(data.items)) {
      throw new Error("Seleziona il file JSON della wishlist esportata da CardTrader.");
    }

    for (const [index, item] of data.items.entries()) {
      if (!item || typeof item.meta_name !== "string" || !item.meta_name.trim() ||
          !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
        throw new Error(`Controlla la voce ${index + 1}: nome o quantità non validi.`);
      }
    }

    // Conserva anche i campi originali che serviranno per cercare le offerte.
    return data;
  }

  function printable(value) {
    return value === null || value === undefined || value === ""
      ? "Non specificato"
      : String(value);
  }

  function language(value) {
    const names = { en: "Inglese", it: "Italiano" };
    if (!value) return "Lingua non specificata";
    return String(value).split("+").map(code => names[code] || code).join(" / ");
  }

  const section = element("section");
  section.id = "wishlist-cardtrader";
  section.append(element("h2", "Wishlist CardTrader"));

  const label = element("label", "Importa da CardTrader");
  const input = element("input");
  input.type = "file";
  input.accept = ".json,application/json";
  label.append(input);
  section.append(label);

  const message = element("p");
  message.setAttribute("role", "status");
  section.append(message);

  const content = element("div");
  section.append(content);

  // Posiziona le wishlist vicino alla sezione delle carte inserite a mano.
  const manualWishlist = document.getElementById("cards")?.closest("section");
  if (manualWishlist) manualWishlist.after(section);
  else document.body.append(section);

  function render(lists) {
    content.replaceChildren();

    for (const list of Object.values(lists)) {
      const details = element("details");
      const copies = list.items.reduce((total, item) => total + item.quantity, 0);
      details.append(element("summary",
        `${list.name} · ${list.items.length} voci · ${copies} copie`));

      for (const item of list.items) {
        const article = element("article");
        // CardTrader esporta un identificativo testuale che può includere gli attacchi.
        const readableName = item.meta_name.replace(/-/g, " ");
        const name = readableName.charAt(0).toUpperCase() + readableName.slice(1);
        article.append(element("h3", name));

        article.append(element("p",
          `Set: ${printable(item.expansion_code)} · Numero: ${printable(item.collector_number)}`));
        article.append(element("p",
          `${language(item.language)} · ${printable(item.condition)} · Copie: ${item.quantity}`));

        if (item.foil != null || item.reverse != null) {
          article.append(element("p",
            `Foil: ${printable(item.foil)} · Reverse: ${printable(item.reverse)}`));
        }

        const q = item.zero_quote;
let testoPrezzo = "Prezzo CardTrader Zero: da rilevare";

if (q && Number.isSafeInteger(q.cents) && q.cents > 0) {
  const prezzo = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(q.cents / 100);

  testoPrezzo = `CardTrader Zero: ${prezzo} · ${language(q.language)}`;
} else if (q && typeof q.status === "string") {
  testoPrezzo = q.status;
}

if (q && q.checked_at && Number.isFinite(Date.parse(q.checked_at))) {
  const data = new Date(q.checked_at).toLocaleDateString("it-IT");
  testoPrezzo += ` · Controllato il ${data}`;
}

article.append(element("small", testoPrezzo));
        details.append(article);
      }

      content.append(details);
    }
  }

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;

    try {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      const list = readWishlist(JSON.parse(text));
      const lists = readLists();

      // Lo stesso ID aggiorna la lista già importata, anche se cambia il nome.
      lists[String(list.id)] = list;
      localStorage.setItem(storageKey, JSON.stringify(lists));
      render(lists);
      message.textContent = `Importazione riuscita: ${list.name}, ${list.items.length} voci.`;

      for (const details of content.children) {
        if (details.firstChild.textContent.startsWith(`${list.name} ·`)) {
          details.open = true;
        }
      }
    } catch (error) {
      message.textContent = error instanceof SyntaxError
        ? "Il file selezionato non contiene un JSON valido."
        : error.message;
    } finally {
      input.value = "";
    }
  });

  try {
    render(readLists());
  } catch (error) {
    message.textContent = error.message;
  }
})();
