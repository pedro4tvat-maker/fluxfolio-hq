Redesign the consultant dashboard to be cleaner, more professional, and focused on essential information.

### Changes:

#### UI/Layout
- **Unified Header**: Simplify the top banner. Group buttons logically (e.g., Agenda, Reports, Diagnostics in one group; Primary "New Company" action prominent).
- **Executive Summary**: Replace the multiple small cards with 4 high-impact dashboard tiles (Active Clients, Monthly Revenue, Critical Alerts, Pending Reports).
- **Daily Focus Area**: Create a "Daily Priorities" section that combines important meetings, overdue deliveries, and client pending items into a single readable list instead of multiple cards.
- **Enhanced Company List**: Redesign the "Empresas acompanhadas" table to be cleaner, using better typography, status badges, and more generous spacing.
- **Reduced Visual Noise**: Remove excessive background colors and borders. Use a consistent, light color palette with subtle shadows.

#### Logic (no backend changes)
- Consolidate existing KPI calculations for the new UI structure.
- Maintain all current data fetching and functionality while presenting it in a more streamlined way.

### Technical Details:
- Modify `src/routes/app.index.tsx`.
- Update `ConsultantPanel` component structure.
- Refactor `ActionCard` and `MiniKpi` into more versatile, professional dashboard components if needed, or replace them with direct Tailwind styles for better control.
- Ensure responsiveness for mobile and tablet views.