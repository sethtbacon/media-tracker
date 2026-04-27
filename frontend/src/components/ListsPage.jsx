import { useState, useEffect, useRef } from "react";
import { getLists, getList } from "../api.js";
import ListsHome from "./ListsHome.jsx";
import ListDetail from "./ListDetail.jsx";
import ListShopping from "./ListShopping.jsx";
import ListImport from "./ListImport.jsx";
import ListTMDBPicker from "./ListTMDBPicker.jsx";

const CELEBRATED_KEY = "lists.celebrated";

export default function ListsPage({ onOpenInLibrary }) {
  // internal views: "home" | "detail" | "shopping" | "import" | "tmdb-picker"
  const [view, setView] = useState("home");
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null);  // ID of the selected list
  const [activeList, setActiveList] = useState(null);       // full detail object
  const [listsTab, setListsTab] = useState("lists");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  function showToast(message, type = "success") {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  async function fetchLists() {
    try {
      const data = await getLists(false);
      setLists(data.items);
      checkCompletions(data.items);
    } catch (e) {
      console.error("Failed to fetch lists", e);
    }
  }

  function checkCompletions(listItems) {
    const celebrated = new Set(
      JSON.parse(localStorage.getItem(CELEBRATED_KEY) || "[]")
    );
    let changed = false;
    for (const list of listItems) {
      const ownedKey = `owned:${list.id}`;
      if (list.owned_completed_at && !celebrated.has(ownedKey)) {
        showToast(`🎉 You own every item in "${list.name}"!`, "success");
        celebrated.add(ownedKey);
        changed = true;
      }
      const watchedKey = `watched:${list.id}`;
      if (list.watched_completed_at && !celebrated.has(watchedKey)) {
        showToast(`👁 You've watched everything in "${list.name}"!`, "success");
        celebrated.add(watchedKey);
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...celebrated]));
    }
  }

  useEffect(() => {
    fetchLists();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshActiveList() {
    if (!activeListId) return;
    try {
      const data = await getList(activeListId);
      setActiveList(data);
    } catch (e) {
      console.error("Failed to refresh list", e);
    }
    fetchLists();
  }

  function navigateToDetail(list) {
    setActiveListId(list.id);
    setActiveList(list); // summary object; ListDetail will load full detail
    setView("detail");
  }

  function navigateToShopping(list = null) {
    setActiveList(list);
    setView("shopping");
  }

  function navigateToImport(list) {
    setActiveList(list);
    setView("import");
  }

  function navigateToTMDB(list = null) {
    setActiveList(list);
    setActiveListId(list?.id ?? null);
    setView("tmdb-picker");
  }

  const toastEl = toast && (
    <div
      className={`toast toast-${toast.type}`}
      onClick={() => setToast(null)}
    >
      {toast.message}
    </div>
  );

  if (view === "detail") {
    return (
      <div className="lists-page">
        <ListDetail
          listId={activeListId}
          onBack={() => { fetchLists(); setView("home"); }}
          onImport={() => navigateToImport(activeList)}
          onShop={() => navigateToShopping(activeList)}
          onOpenInLibrary={onOpenInLibrary}
          onRefresh={refreshActiveList}
          onShowToast={showToast}
        />
        {toastEl}
      </div>
    );
  }

  if (view === "shopping") {
    return (
      <div className="lists-page">
        <ListShopping
          list={activeList}
          onBack={() => {
            if (activeList) {
              refreshActiveList();
              setView("detail");
            } else {
              setView("home");
            }
          }}
          onAdded={() => {
            refreshActiveList();
            showToast("Added to your collection ✓", "success");
          }}
          onShowToast={showToast}
        />
        {toastEl}
      </div>
    );
  }

  if (view === "import") {
    return (
      <div className="lists-page">
        <ListImport
          list={activeList}
          onBack={() => { refreshActiveList(); setView("detail"); }}
          onTMDB={() => navigateToTMDB(activeList)}
          onImportDone={(result) => {
            const msg = `Imported ${result.imported} · Matched ${result.matched}`;
            showToast(msg, "success");
            refreshActiveList();
            setView("detail");
          }}
          onManualAdded={refreshActiveList}
          onShowToast={showToast}
        />
        {toastEl}
      </div>
    );
  }

  if (view === "tmdb-picker") {
    const fromHome = activeList == null;
    return (
      <div className="lists-page">
        <ListTMDBPicker
          list={activeList}
          onBack={() => fromHome ? setView("home") : setView("import")}
          onImportDone={(result, listId) => {
            const msg = `Imported ${result.imported} · Matched ${result.matched}`;
            showToast(msg, "success");
            fetchLists();
            setActiveListId(listId);
            setView("detail");
          }}
          onShowToast={showToast}
        />
        {toastEl}
      </div>
    );
  }

  // Home view
  return (
    <div className="lists-page">
      <ListsHome
        lists={lists}
        tab={listsTab}
        onTabChange={setListsTab}
        onSelect={navigateToDetail}
        onShop={navigateToShopping}
        onFromTMDB={() => navigateToTMDB(null)}
        onRefetch={fetchLists}
        onShowToast={showToast}
      />
      {toastEl}
    </div>
  );
}
