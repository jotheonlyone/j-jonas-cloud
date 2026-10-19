# Umsetzungsplan: Frutiger Aero / Windows 7 Modus

Dieses Dokument beschreibt die strukturierte und schrittweise Umsetzung des neuen Features **„Frutiger Aero / Windows 7 Modus“** für die J.Jonas Cloud.

---

## 1. Übersicht & Zielsetzung

Der neue Modus transformiert die Cloud-Benutzeroberfläche in die ikonische Ästhetik der späten 2000er Jahre (Windows 7 Aero Glass & Frutiger Aero) – mit lebendigen Himmels- und Wassergradienten, transluzenten Glas-Effekten mit Lichtreflexen, glänzenden Glossy-Buttons und schwebenden organischen Glow-Wasserblasen. Gleichzeitig wird eine dezente, authentische Hintergrund-Klangkulisse (*Aquatic Ambience*) geladen, die sich nahtlos in die Cloud einbettet und bei regulärer Medienwiedergabe automatisch pausiert.

---

## 2. Abgestimmte Anforderungen & Designentscheidungen

Basierend auf den Anforderungen und den geklärten Präferenzen:
1. **Platzierung im UI:**
   - Direkt unter dem Menüeintrag *„Cinema (Video on Demand)“* im Profil-Dropdown (oben rechts bei Klick auf den Benutzer-Avatar).
   - Eintrag: **„Frutiger Aero 7“** mit passendem Icon (Aero Orb / Sparkles / Droplet) und visuellem Umschalt-Status (Toggle / Status-Indikator).
   - Der Aktivierungszustand wird im `localStorage` unter `jjcloud_frutiger_aero` (`'true'` / `'false'`) dauerhaft gespeichert und beim Laden der App initialisiert.
2. **Visuelles Theme (Aero Glass & Frutiger Aero):**
   - Aktivierung über die globale Klasse `.theme-frutiger-aero` am Root-Element (`<html>` bzw. `<body>`).
   - **Hintergrund:** Dynamische Aero-Landschaft mit sanften Gradients (Himmelblau, Wassergrün, Lichtschein) und lebendigen, schwebenden SVG/CSS-Glow-Wasserblasen mit realistischen Glanzlichtern.
   - **Aero Glass:** Transluzente Container (`backdrop-filter: blur(16px) saturate(160%)`), feine helle 1px-Lichtkanten (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.7)`), weiche Schatten und abgerundete Ecken im Windows-7-Stil.
   - **Buttons & Steuerelemente:** Glänzende Glossy-Gel-Buttons mit hellem Glanzstreifen und feiner Wölbung.
   - Vollständige Kompatibilität: Das bestehende Layout und die Dark-/Light-Mode-Grundfunktionalität bleiben absolut intakt.
3. **Automatische Hintergrundmusik (Aquatic Ambience):**
   - **Dateisuche im gesamten Speicher:** Durchsucht bei Aktivierung (oder App-Start im aktiven Zustand) rekursiv den gesamten Nutzerspeicher (Hauptverzeichnis + Unterordner) nach:
     1. `aquatic ambience.mp3`
     2. `slowed  reverb - aquatic ambience.mp3`
   - **Wiedergabelogik & Loop:**
     - Wenn beide existieren: Sequenzielle Wiedergabe nacheinander in einer Endlosschleife (Loop).
     - Wenn nur eine existiert: Endlosschleife dieser einen Datei.
     - Wenn keine existiert: Vollkommen lautlos ohne Fehlermeldungen, Benachrichtigungen oder Pop-ups.
   - **Streaming:** Nutzung der bestehenden Streaming-Route (`/stream?user=...&path=...`).
   - **Intelligente Medien-Reaktion:**
     - Sanfte, dezente Lautstärke (standardmäßig ~25–30 %).
     - **Automatische Pausierung:** Sobald der Nutzer einen Song in der Cloud startet (`AudioPlayerContext.isPlaying === true`) oder ein Video abspielt (`MediaViewerModal` oder `CinemaPlayer`), pausiert die Hintergrundmusik sofort.
     - **Automatisches Fortsetzen:** Sobald Song/Video pausiert oder beendet wird, setzt die Aquatic-Ambience-Musik sanft wieder ein.
     - **Sofortiger Stopp:** Sobald der Frutiger-Aero-Modus deaktiviert wird, stoppt die Musik sofort.

---

## 3. Architektur & Modulare Komponenten

### 3.1 State & Persistence
- **State-Verwaltung:** `isFrutigerAero` State in `App.tsx` (oder dedizierter Context/Hook `useFrutigerAero`).
- **Initialisierung:** Liest beim Laden `localStorage.getItem('jjcloud_frutiger_aero') === 'true'`.
- **Root-Synchronisation:**
  ```ts
  useEffect(() => {
    if (isFrutigerAero) {
      document.documentElement.classList.add('theme-frutiger-aero');
      localStorage.setItem('jjcloud_frutiger_aero', 'true');
    } else {
      document.documentElement.classList.remove('theme-frutiger-aero');
      localStorage.setItem('jjcloud_frutiger_aero', 'false');
    }
  }, [isFrutigerAero]);
  ```

### 3.2 UI-Integration im Konto-Menü (`Header.tsx`)
- In `Header.tsx` direkt nach dem Button für `cinema` (Zeilen 275–292):
  - Umschaltbarer Button:
    - Icon: Windows-7-Aero-Orb / Droplet / Sparkles mit lebendigem Cyan/Blau-Farbverlauf.
    - Titel: *„Frutiger Aero 7“*.
    - Toggle-Badge: Zeigt „Aktiv“ (mit leuchtendem Cyan/Grün-Glow) oder „Aus“ an.
    - Klick toggelt den Modus und aktualisiert das UI.

### 3.3 Frutiger Aero Canvas & CSS Styling (`index.css` & `FrutigerAeroBackground.tsx`)
- **`FrutigerAeroBackground.tsx`:**
  - Wird bedingt gerendert, wenn `isFrutigerAero === true`.
  - Enthält die Frutiger-Aero-Hintergrundebene:
    - Strahlend blauer Himmel mit weichem Übergang zu sonnigem Grün/Cyan.
    - Sanfte Lichtstrahlen (Aurora Borealis / Sunburst Rays).
    - Zarte, organisch animierte Glanz-Wasserblasen (SVG mit radialem Glanzlicht und Reflexion), die mit leichten Schwebereflexen aufsteigen.
    - Zeigt eine dezente, minimalistische Musik-Statusanzeige (z. B. feine Note mit aktuellem Ambience-Track), unaufdringlich am Bildschirmrand, inklusive stummschaltbarem Mini-Controller.
- **Aero Glass CSS-Klassen (`index.css`):**
  - Definition von `.theme-frutiger-aero`:
    - Header & Sidebar erhalten transluzentes Glas (`backdrop-filter: blur(20px) saturate(180%)`, weiße Glasur `rgba(255,255,255,0.45)`, feine 1px Lichtkante).
    - Ordner- und Datei-Karten erhalten Windows-7-Glas-Rahmen mit weichen Glanz-Highlights.
    - Buttons erhalten den typischen Windows-7-Aero-Gloss (zweigeteilter Lichtschein-Verlauf).

### 3.4 Ambience-Audiomanager (`useFrutigerAmbience.ts` / `frutigerAmbienceService.ts`)
- **Dateisuche:**
  - Rekursive Traversierung: Sucht im Wurzelverzeichnis (`""`) und allen Unterordnern nach den beiden Dateien `aquatic ambience.mp3` und `slowed  reverb - aquatic ambience.mp3`.
  - Normalisierter Namensabgleich (ignoriert Mehrfachleerzeichen oder Groß-/Kleinschreibung).
- **Audio-Steuerung:**
  - Verwendet eine dedizierte `HTMLAudioElement`-Instanz.
  - Playlist-Handling: Spielt bei Vorhandensein beider Tracks `aquatic ambience.mp3` -> `slowed  reverb - aquatic ambience.mp3` in Endlosschleife; bei einer Datei diese im Loop.
  - Lautstärkeeinstellung: Sanft (~0.28) mit weichem Ein-/Ausfaden (Fade-in/Fade-out).
  - Listener auf App-Audio/Video:
    - Prüft `isPlaying` aus `useAudioPlayer()`.
    - Prüft aktives Video in `MediaViewerModal` (`viewerItem` ist Video) und Cinema-Wiedergabe.
    - Pausiert automatisch bei Fremd-Audio/-Video und startet wieder nach Beendigung.

---

## 4. Schrittweise Implementierungsphasen

### Phase 1: State, Persistence & Konto-Menü Integration
1. **`App.tsx`:**
   - State `isFrutigerAero` mit `localStorage`-Initialisierung hinzufügen.
   - Synchronisations-Effekt für `.theme-frutiger-aero` Klasse anlegen.
   - Umschalt-Funktion `toggleFrutigerAero` bereitstellen und an `Header.tsx` übergeben.
2. **`Header.tsx`:**
   - Props um `isFrutigerAero` und `onToggleFrutigerAero` erweitern.
   - Neuen Menüeintrag direkt unter *„Cinema (Video on Demand)“* mit stilvollem Aero-Icon und Toggle-Switch einfügen.

### Phase 2: Frutiger Aero Styling & Dynamischer Hintergrund
1. **`FrutigerAeroBackground.tsx`:**
   - Erstellen einer maßgeschneiderten Hintergrundkomponente mit Aero-Himmel, Sonnenlicht-Reflexen und schwebenden transluzenten Wasserblasen.
2. **`index.css` Erweiterung:**
   - Spezifische Glassmorphism- und Glossy-Stile unter `.theme-frutiger-aero` einbinden.
   - Buttons, Header, Sidebar und Dateikarten harmonisch im Windows 7 / Aero Style glänzen lassen.

### Phase 3: Hintergrundmusik-Engine (Aquatic Ambience)
1. **Such- und Streaming-Logik:**
   - Funktion zum rekursiven Auffinden von `aquatic ambience.mp3` und `slowed  reverb - aquatic ambience.mp3` über `listFiles` des angemeldeten Nutzers.
   - Automatische Erkennung und Erstellung der Playlist-URLs via `/stream?user=...&path=...`.
2. **Audio-Management & Smart-Pause:**
   - Hook / Service `useFrutigerAmbience`:
     - Verwalten des Loops und Übergangs zwischen Song 1 und 2.
     - Beobachten von `AudioPlayerContext` (`isPlaying`) und `viewerItem` (aktives Video) zur automatischen Pausierung.
     - Vollkommen geräuschloses Verhalten ohne Fehlermeldung, falls die Dateien nicht existieren.

### Phase 4: Überprüfung & Qualitätssicherung
1. **Linting & Compilation:**
   - Ausführen von `lint_applet` und `compile_applet`.
2. **Funktionstests:**
   - Umschalten des Modus über das Konto-Menü.
   - Prüfung der `localStorage`-Persistenz nach Seiten-Reload.
   - Überprüfung des Designs bei Hell- und Dunkelmodus.
   - Testen der Musik-Wiedergabe, des automatischen Pausierens bei Start eines Cloud-Tracks/Videos und des Stoppens beim Deaktivieren des Modus.

---

## 5. Betroffene Dateien
- `src/App.tsx`: State-Verwaltung, Synchronisation, Integration der Hintergrundkomponente und Audio-Reaktion.
- `src/components/Header.tsx`: Platzierung des Umschalters im Account-Dropdown direkt unter Cinema-Modus.
- `src/components/FrutigerAeroBackground.tsx` *(neu)*: Hintergrundlandschaft mit schwebenden Glow-Blasen.
- `src/hooks/useFrutigerAmbience.ts` *(neu)*: Rekursive Dateisuche, Audioplayer-Logik, Smart-Pausierung & Loop.
- `src/index.css`: Glassmorphism-, Glossy-Button- und Aero-7-Stile.
