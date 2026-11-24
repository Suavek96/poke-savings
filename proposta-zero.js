(() => {
  "use strict";

  const LISTE = "poke-savings-cardtrader-lists-v1";
  const livelli = ["Alta", "Media", "Bassa"];
  const perId = id => document.getElementById(id);
  const formato = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  });
  const euro = cent => formato.format(cent / 100);

  function nodo(tag, testo) {
    const el = document.createElement(tag);
    if (testo !== undefined) el.textContent = testo;
    return el;
  }

  function nomeCarta(item) {
    const nome = item.meta_name.replace(/-/g, " ");
    return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} · ` +
      `${item.expansion_code || "Set sconosciuto"} #${item.collector_number || "?"}`;
  }

  function identita(item) {
    // Conserva i criteri della wishlist anche quando cambia la quotazione.
    const criteri = Object.keys(item)
      .filter(k => k !== "zero_quote" && k !== "quantity")
      .sort()
      .map(k => [k, item[k]]);
    return JSON.stringify(criteri);
  }

  function leggiCarte() {
    const liste = JSON.parse(localStorage.getItem(LISTE) || "{}");
    const carte = new Map();

    for (const lista of Object.values(liste)) {
      for (const item of lista.items) {
        const key = identita(item);
        const vecchia = carte.get(key);
        const data = Date.parse(item.zero_quote?.checked_at) || 0;
        if (!vecchia || data > vecchia.data) {
          carte.set(key, { key, item, data });
        }
      }
    }

    return [...carte.values()].sort((a, b) =>
      nomeCarta(a.item).localeCompare(nomeCarta(b.item), "it", { numeric: true })
    );
  }

  function prezzo(item) {
    const cent = item.zero_quote?.cents;
    return Number.isSafeInteger(cent) && cent > 0 ? cent : null;
  }

  const sezione = nodo("section");
  sezione.append(nodo("h2", "I miei obiettivi CardTrader"));
  const introduzione = nodo("p",
    "Scegli una carta e indica quanto vorresti pagarla per una copia.");
  sezione.append(introduzione);

  const form = nodo("form");
  const griglia = nodo("div");
  griglia.className = "grid";

  function campo(titolo, controllo) {
    const label = nodo("label", titolo);
    label.append(controllo);
    griglia.append(label);
  }

  const scelta = nodo("select");
  campo("Carta della wishlist", scelta);

  const soglia = nodo("input");
  soglia.type = "text";
  soglia.inputMode = "decimal";
  soglia.placeholder = "Esempio: 2,50";
  campo("Prezzo desiderato (€)", soglia);

  const priorita = nodo("select");
  for (const livello of livelli) priorita.add(new Option(livello, livello));
  campo("Priorità", priorita);

  form.append(griglia);
  const azioni = nodo("div");
  azioni.className = "actions";
  const salva = nodo("button", "Salva obiettivo");
  salva.type = "submit";
  azioni.append(salva);
  form.append(azioni);
  sezione.append(form);

  const dettaglio = nodo("p");
  dettaglio.setAttribute("role", "status");
  sezione.append(dettaglio);

  const proposta = perId("planText");
  if (!proposta) return;
  proposta.closest("section").after(sezione);

  let carte = [];
  let firmaOpzioni = "";

  function mostraCarta() {
    const carta = carte.find(c => c.key === scelta.value);
    if (!carta) {
      dettaglio.textContent =
        "Importa il file PokeSavings-Zero nella sezione Wishlist CardTrader.";
      return;
    }

    const pref = state.zeroGoals?.[carta.key];
    soglia.value = pref ? (pref.target / 100).toFixed(2).replace(".", ",") : "";
    priorita.value = pref?.priority || "Media";

    const cent = prezzo(carta.item);
    if (cent === null) {
      dettaglio.textContent = "Per questa carta manca una quotazione Zero utilizzabile.";
      return;
    }

    const data = carta.data ? new Date(carta.data).toLocaleDateString("it-IT") : "";
    let testo = `Prezzo Zero rilevato: ${euro(cent)}${data ? " il " + data : ""}.`;
    if (pref && cent > pref.target) {
      testo += ` Deve scendere di ${euro(cent - pref.target)} per raggiungere il tuo obiettivo.`;
    } else if (pref) {
      testo += " Rientra nel tuo prezzo desiderato.";
    }
    dettaglio.textContent = testo;
  }

  scelta.onchange = mostraCarta;

  form.onsubmit = evento => {
    evento.preventDefault();
    run(() => {
      const key = scelta.value;
      if (!key) throw Error("Seleziona una carta.");
      const target = amount(soglia.value);
      const priority = priorita.value;

      change(s => {
        if (!s.zeroGoals) s.zeroGoals = {};
        s.zeroGoals[key] = { target, priority };
      });

      mostraCarta();
      note("Obiettivo CardTrader salvato. Proposta aggiornata.");
    });
  };

  function aggiornaSelettore() {
    const firma = JSON.stringify(carte.map(c => [c.key, c.data, prezzo(c.item)]));
    if (firma === firmaOpzioni) return;
    firmaOpzioni = firma;
    const precedente = scelta.value;
    scelta.replaceChildren();

    for (const c of carte) {
      const info = [c.item.language, c.item.condition].filter(Boolean).join(" · ");
      scelta.add(new Option(
        nomeCarta(c.item) + (info ? ` · ${info}` : ""), c.key
      ));
    }

    if (carte.some(c => c.key === precedente)) scelta.value = precedente;
    form.hidden = carte.length === 0;
    mostraCarta();
  }

  window.aggiornaPropostaZero = function (manuali, budget) {
    carte = leggiCarte();
    aggiornaSelettore();

    const candidati = [];

    for (const c of manuali) {
      if (c.checked && c.target !== null && c.price <= c.target) {
        candidati.push({
          nome: title(c), prezzo: c.price, priorita: c.priority, fonte: "Manuale"
        });
      }
    }

    for (const c of carte) {
      const pref = state.zeroGoals?.[c.key];
      const cent = prezzo(c.item);
      if (pref && cent !== null && cent <= pref.target) {
        candidati.push({
          nome: nomeCarta(c.item), prezzo: cent, priorita: pref.priority,
          fonte: "CardTrader Zero"
        });
      }
    }

    candidati.sort((a, b) =>
      livelli.indexOf(a.priorita) - livelli.indexOf(b.priorita) ||
      a.prezzo - b.prezzo || a.nome.localeCompare(b.nome, "it")
    );

    let residuo = budget;
    const lista = perId("plan");
    lista.replaceChildren();

    for (const c of candidati) {
      if (c.prezzo > residuo) continue;
      residuo -= c.prezzo;
      lista.append(nodo("li",
        `${c.nome} · ${euro(c.prezzo)} · Priorità ${c.priorita} · ${c.fonte}`));
    }

    const n = lista.children.length;
    perId("planDetails").hidden = n === 0;

    if (n > 0) {
      proposta.textContent =
        `${n} ${n === 1 ? "carta proposta" : "carte proposte"} · ` +
        `Totale ${euro(budget - residuo)} · Restano ${euro(residuo)} spendibili.`;
    } else if (candidati.length > 0) {
      proposta.textContent =
        `Ci sono carte entro il prezzo desiderato, ma il budget spendibile è ${euro(budget)}.`;
    } else {
      proposta.textContent =
        "Nessuna carta entro un obiettivo impostato. Scegli una carta qui sotto per iniziare.";
    }
  };

  // Ricalcola dopo l'importazione di un nuovo file prezzi nella stessa pagina.
  const boxImportazione = perId("wishlist-cardtrader");
  if (boxImportazione) {
    const esito = boxImportazione.querySelector('[role="status"]');
    if (esito) {
      new MutationObserver(() => run(render))
        .observe(esito, { childList: true, characterData: true, subtree: true });
    }
  }

  run(render);
})();
