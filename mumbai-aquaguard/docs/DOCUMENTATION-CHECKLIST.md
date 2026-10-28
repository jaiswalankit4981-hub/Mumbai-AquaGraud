# Documents to submit alongside the build

Grouped by when you will need them. The SRS you already have covers item 3.

## Before you build (approval stage)
1. **Project synopsis / abstract** — 2 to 3 pages: problem, proposed solution, scope,
   technology, expected outcome. Usually the first thing a guide signs off.
2. **Literature survey / existing system study** — 8 to 12 references: BMC flood
   control room practice, published waterlogging sensor papers, Google Maps and
   MCGM alert apps, IoT flood-monitoring work. For each: what it does, what it
   misses, how AquaGuard differs. This is where you argue that open-manhole
   detection plus hazard-aware routing is the gap you fill.
3. **Software Requirements Specification** — the document you already wrote.
4. **Feasibility study** — technical, economic (a bill of materials makes this
   concrete), operational and schedule feasibility.
5. **Project plan / Gantt chart** — weekly breakdown across the semester with
   milestones: hardware assembly, backend, map, routing, SOS, testing, report.

## Design stage
6. **Software Design Document (SDD) / low-level design** — architecture diagram,
   module descriptions, class or collection diagram, sequence diagrams, API
   contract. Most of the raw material is in `docs/DIAGRAMS.md` and `docs/API.md`.
7. **UML set** — use case, class, sequence, activity, state chart (the SOS and
   manhole status machines are natural state charts), deployment diagram.
8. **Data flow diagrams** — level 0 and level 1, both drafted in `docs/DIAGRAMS.md`.
9. **ER diagram and data dictionary** — every collection, every field, type, size,
   constraint, sample value. Tedious but examiners check it.
10. **Circuit diagram and wiring table** — draw the ESP32 schematic in Fritzing or
    EasyEDA; `firmware/wiring.md` has the pin map to copy from.
11. **Bill of materials** — component, quantity, unit price, supplier, total. Shows
    the prototype cost and supports the feasibility section.
12. **UI wireframes / screen design document** — hand sketches are fine; pair each
    wireframe with a screenshot of the finished screen.

## Build and test stage
13. **Test plan and test case report** — `docs/TEST-PLAN.md`, with the Result column
    filled in and dated.
14. **Sensor calibration log** — the ruler-versus-reading table from H-01 to H-03.
    This is the evidence that your readings mean something.
15. **Bug and change log** — what broke, what you changed, why. Weekly entries beat
    one retrospective dump.
16. **Deployment / installation guide** — prerequisites, `.env` values, how to seed,
    how to flash the ESP32, how to run the simulator.
17. **User manual** — one page for citizens, one for the control room, with
    annotated screenshots. Include the line that SOS does not replace 100/101/108.

## Submission stage
18. **Main project report** — the bound volume. Usual order: certificate, declaration,
    acknowledgement, abstract, contents, list of figures and tables, introduction,
    literature survey, system analysis, system design, implementation, testing,
    results and screenshots, conclusion, future scope, references, appendices
    (code listing, datasheets).
19. **Results and screenshots annexure** — map with live markers, critical alert,
    manhole alert, three route options with a warning, SOS on the admin screen,
    analytics charts, hardware photos, serial monitor output.
20. **Presentation deck** — 12 to 15 slides, with a demo video embedded as backup in
    case the WiFi fails on demo day.
21. **Demo video** — 3 to 5 minutes: pour water into the tray, show the depth rising
    on screen, lift the manhole cover, show the alert, replan the route.
22. **References and bibliography** — IEEE style, and cite the datasheets too.
23. **Plagiarism report** — many colleges ask for a Turnitin or similar percentage.
24. **Individual contribution sheet** — who did hardware, backend, frontend, report.

## Worth adding, and often what lifts a grade
25. **Ethics, privacy and data-handling note** — what location data you collect, why,
    who can see it, how long you keep it, and the consent flow. Directly supports
    SRS 19.5 and reads well in the viva.
26. **Risk register** — sensor failure, false citizen reports, network loss, GPS drift
    indoors, OSRM rate limits; likelihood, impact, mitigation.
27. **Limitations and future scope note** — SRS sections 28 and 29, expanded with what
    you actually hit during testing.
28. **Deployment cost estimate for a real ward** — extrapolate the BOM to 50 nodes,
    add SIM data and maintenance. Turns a college prototype into a proposal.
29. **Comparison table** — AquaGuard versus Google Maps, MCGM alerts, and a plain
    water-level monitor, feature by feature.
30. **Research paper draft** — if your department encourages publication, the SRS plus
    the test results are already most of an IEEE-format 6-pager.
