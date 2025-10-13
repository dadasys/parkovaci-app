import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const supabase = createClient(supabaseUrl, supabaseKey);

type Role = "admin" | "user";
interface User {
  id: number;
  username: string;
  password: string;
  role: Role;
  name?: string;
  spz?: string;
  priority?: boolean;
}

interface Reservation {
  id: number;
  place: number;
  time: string;
  userId: number;
  date: string;        // ← důležité
  time_slot: string;
}

const times = ["7-13", "13-00"] as const;
const days = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"] as const;
const places = [1, 2, 3, 4, 5, 6];

// Výpočet pracovního týdne (Po–Pá), každý den ve 12:00 → žádný UTC posun
function getWeekDates(weekOffset: number) {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
  const monday = new Date(today.setDate(diff));
  monday.setHours(12, 0, 0, 0);

  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    d.setHours(12, 0, 0, 0);
    return d;
  });
}

function getWeekRangeLabel(weekOffset: number) {
  const dates = getWeekDates(weekOffset);
  const monday = dates[0];
  const friday = dates[4];
  return `${monday.toLocaleDateString("cs-CZ")} - ${friday.toLocaleDateString("cs-CZ")}`;
}

// Pomocná funkce: YYYY-MM-DD
function formatLocalISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Počet pracovních dní pro omezení rezervací
function getWorkingDaysDiff(from: Date, to: Date): number {
  let count = 0;
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const target = new Date(to);
  target.setHours(0, 0, 0, 0);

  while (d < target) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

function LoginView({ onLogin, error, users }: { onLogin: (u: string, p: string) => void; error: string | null; users: User[] }) {
  const [username, setUsername] = useState(users[0]?.username || "");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username.trim(), password);
  };

  useEffect(() => {
    if (users.length && !users.find(u => u.username === username)) {
      setUsername(users[0].username);
    }
  }, [users]);

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 460, margin: "60px auto" }}>
        <h2 style={{ textAlign: "center" }}>Přihlášení</h2>
        <form onSubmit={handleSubmit}>
          <select value={username} onChange={(e) => setUsername(e.target.value)} className="input" style={{ marginBottom: 12 }}>
            {users.map((u) => (
              <option key={u.id} value={u.username}>
                {u.username} {u.name ? `(${u.name})` : ""}
              </option>
            ))}
          </select>
          <input
            placeholder="Heslo"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            style={{ marginBottom: 12 }}
          />
          <button type="submit" className="btn" style={{ width: "100%" }}>
            Přihlásit
          </button>
          {error && <div style={{ color: "#ef4444", marginTop: 10, textAlign: "center", fontWeight: 600 }}>{error}</div>}
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [view, setView] = useState<"login" | "reservations">("login");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.from("users").select("*").order("id");
      if (userData) setUsers(userData as User[]);
      const { data: resData } = await supabase.from("reservations").select("*").order("id");
      if (resData) setReservations(resData as Reservation[]);
    })();
  }, []);

  const handleLogin = (username: string, password: string) => {
    const found = users.find((u) => u.username === username && u.password === password);
    if (found) {
      setCurrentUser(found);
      setView("reservations");
      setLoginError(null);
    } else setLoginError("Neplatné jméno nebo heslo");
  };

  const handleReserve = async (place: number, day: string, time: string, date: Date) => {
    if (!currentUser) return;

    const workingDiff = getWorkingDaysDiff(new Date(), date);
    if (!currentUser.priority && workingDiff > 2) {
      alert("Neprioritní uživatel může rezervovat maximálně 2 pracovní dny dopředu.");
      return;
    }

    const localDateStr = formatLocalISO(date);

    const exists = reservations.find(
      (r) => r.place === place && r.date === localDateStr && r.time_slot === time
    );
    if (exists) return;

    const { data: newData, error } = await supabase.from("reservations").insert([{
      place,
      time: `${day} ${time}`,   // weekOffset už neukládáme
      userId: currentUser.id,
      date: localDateStr,
      time_slot: time
    }]).select();

    if (error) {
      alert(error.message);
      return;
    }
    if (newData) setReservations([...reservations, ...(newData as Reservation[])]);
  };

  if (view === "login") return <LoginView onLogin={handleLogin} error={loginError} users={users} />;

  return (
    <div className="container">
      <div className="header">
        <h2>Vítej, {currentUser?.name}</h2>
        <div>
          <button className="btn" onClick={() => { setCurrentUser(null); setView("login"); }}>Odhlásit</button>
        </div>
      </div>
      <div className="card">
        <h3>Rezervace parkovacích míst</h3>
        <div className="weekbar">
          <button className="btn" onClick={() => setWeekOffset(weekOffset - 1)}>◀️ Předchozí týden</button>
          <strong>{getWeekRangeLabel(weekOffset)}</strong>
          <button className="btn" onClick={() => setWeekOffset(weekOffset + 1)}>Následující týden ▶️</button>
        </div>

        <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
          {days.map((day, i) => {
            const dayDate = weekDates[i];
            const dayISO = formatLocalISO(dayDate);

            return (
              <div key={day} className="card" style={{ padding: 10 }}>
                <h4 style={{ textAlign: "center" }}>{day} {dayDate.toLocaleDateString("cs-CZ")}</h4>
                {times.map((time) => (
                  <div key={time} className="slot">
                    <strong>{time}</strong>
                    {places.map((place) => {
                      const reservation = reservations.find(
                        (r) => r.place === place && r.date === dayISO && r.time_slot === time
                      );
                      const owner = reservation ? users.find(u => u.id === reservation.userId) : null;
                      const isPriority = owner?.priority;
                      return (
                        <div key={place} className="slot" style={{ background: reservation ? (isPriority ? "#fde68a" : "#fef9c3") : "#fff" }}>
                          {!reservation ? (
                            <>
                              <span style={{ marginRight: 6 }}>{place}</span>
                              <button
                                className="btn btn-success"
                                onClick={() => handleReserve(place, day, time, dayDate)}
                              >
                                Rezervovat
                              </button>
                            </>
                          ) : (
                            <span>
                              {owner?.name} ({owner?.spz}){" "}
                              {isPriority && <span className="badge">prioritní</span>}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
