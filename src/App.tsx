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
}

const times = ["7-13", "13-00"] as const;
const days = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"] as const;
const places = [1, 2, 3, 4, 5, 6];

function getWeekDates(weekOffset: number) {
  const start = new Date();
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
  const monday = new Date(start.setDate(diff));
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}
function getWeekRangeLabel(weekOffset: number) {
  const dates = getWeekDates(weekOffset);
  const monday = dates[0];
  const friday = dates[4];
  return `${monday.toLocaleDateString("cs-CZ")} - ${friday.toLocaleDateString("cs-CZ")}`;
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

function UserAdmin({ users, setUsers }: { users: User[]; setUsers: (u: User[]) => void }) {
  const handleLocalChange = (id: number, field: keyof User, value: any) => {
    setUsers(users.map((u) => (u.id === id ? { ...u, [field]: value } : u)));
  };
  const handlePersist = async (user: User, field: keyof User) => {
    const { error } = await supabase.from("users").update({ [field]: (user as any)[field] }).eq("id", user.id);
    if (error) alert("Chyba ukládání: " + error.message);
  };
  return (
    <div className="container">
      <div className="header">
        <h2>Správa uživatelů</h2>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Jméno</th>
              <th>Uživatel</th>
              <th>Heslo</th>
              <th>Role</th>
              <th>SPZ</th>
              <th>Priorita</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><input className="input" value={u.name || ""} onChange={(e) => handleLocalChange(u.id, "name", e.target.value)} onBlur={() => handlePersist(u, "name")} /></td>
                <td>{u.username}</td>
                <td><input className="input" value={u.password} onChange={(e) => handleLocalChange(u.id, "password", e.target.value)} onBlur={() => handlePersist(u, "password")} /></td>
                <td>
                  <select className="input" value={u.role} onChange={(e) => handleLocalChange(u.id, "role", e.target.value as Role)} onBlur={() => handlePersist(u, "role")}>
                    <option value="admin">admin</option>
                    <option value="user">user</option>
                  </select>
                </td>
                <td><input className="input" value={u.spz || ""} onChange={(e) => handleLocalChange(u.id, "spz", e.target.value)} onBlur={() => handlePersist(u, "spz")} /></td>
                <td style={{ textAlign: "center" }}>
                  <input type="checkbox" checked={u.priority || false} onChange={(e) => handleLocalChange(u.id, "priority", e.target.checked)} onBlur={() => handlePersist(u, "priority")} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [view, setView] = useState<"login" | "reservations" | "userAdmin">("login");
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
    if (found) { setCurrentUser(found); setView("reservations"); setLoginError(null); }
    else setLoginError("Neplatné jméno nebo heslo");
  };

  const handleReserve = async (place: number, day: string, time: string) => {
    if (!currentUser) return;
    const key = `${day} ${time} ${weekOffset}`;
    const exists = reservations.find((r) => r.place === place && r.time === key);
    if (exists) return;
    const { data, error } = await supabase.from("reservations").insert([{ place, time: key, userId: currentUser.id }]).select();
    if (error) { alert(error.message); return; }
    if (data) setReservations([...reservations, ...(data as Reservation[])]);
  };

  const handleCancel = async (id: number) => {
    if (!currentUser) return;
    const reservation = reservations.find((r) => r.id === id);
    if (!reservation) return;
    if (reservation.userId !== currentUser.id && currentUser.role !== "admin") return;
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setReservations(reservations.filter((r) => r.id !== id));
  };

  if (view === "login") return <LoginView onLogin={handleLogin} error={loginError} users={users} />;

  if (view === "userAdmin") {
    if (currentUser?.role !== "admin") {
      return (
        <div className="container">
          <div className="card"><p>Přístup zamítnut</p><button className="btn" onClick={() => setView("reservations")}>Zpět</button></div>
        </div>
      );
    }
    return (
      <div>
        <div className="container">
          <div className="header">
            <h2>Vítej, {currentUser?.name}</h2>
            <div>
              <button className="btn" style={{ marginRight: 8 }} onClick={() => setView("reservations")}>Zpět na rezervace</button>
              <button className="btn" onClick={() => { setCurrentUser(null); setView("login"); }}>Odhlásit</button>
            </div>
          </div>
        </div>
        <UserAdmin users={users} setUsers={setUsers} />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h2>Vítej, {currentUser?.name}</h2>
        <div>
          {currentUser?.role === "admin" && <button className="btn" style={{ marginRight: 8 }} onClick={() => setView("userAdmin")}>Správa uživatelů</button>}
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
          {days.map((day, i) => (
            <div key={day} className="card" style={{ padding: 10 }}>
              <h4 style={{ textAlign: "center" }}>{day} {weekDates[i].toLocaleDateString("cs-CZ")}</h4>
              {times.map((time) => (
                <div key={time} className="slot">
                  <strong>{time}</strong>
                  {places.map((place) => {
                    const reservation = reservations.find((r) => r.place === place && r.time === `${day} ${time} ${weekOffset}`);
                    const owner = reservation ? users.find(u => u.id === reservation.userId) : null;
                    const isPriority = owner?.priority;
                    return (
                      <div key={place} className="slot" style={{ background: reservation ? (isPriority ? "#fde68a" : "#fef9c3") : "#fff" }}>
                        {reservation ? (
                          <>
                            <span>{owner?.name} ({owner?.spz}) {isPriority && <span className="badge">prioritní</span>}</span>
                            {(currentUser?.role === "admin" || reservation.userId === currentUser?.id) && (
                              <button className="btn btn-danger" style={{ marginLeft: 8 }} onClick={() => handleCancel(reservation.id)}>Zrušit</button>
                            )}
                          </>
                        ) : (
                          <button className="btn btn-success" onClick={() => handleReserve(place, day, time)}>Rezervovat</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
