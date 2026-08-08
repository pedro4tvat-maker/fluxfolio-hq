# Agenda para o login de empresário

Hoje a Agenda existe apenas no modo consultor: a página `/app/agenda` mostra "A Agenda é exclusiva para consultores" para quem entra como empresa, e as atividades ficam gravadas por consultoria. A ideia é dar à empresa o mesmo calendário, com os dados dela.

Nenhum dado existente será apagado ou alterado.

## O que será feito

1. **Nova área de agenda da empresa** no mesmo endereço `/app/agenda`, com as mesmas três abas do consultor: Calendário (mensal, clicando no dia abre todas as atividades daquele dia), Reuniões e uma listagem por período.
2. **Item "Agenda" no menu lateral** do login de empresa, dentro do grupo Organização.
3. **Cadastro de atividades da empresa**: título, descrição, data/hora, tipo, prioridade, status, responsável, local/link e lembrete — mesmos campos e mesma aparência da agenda do consultor.
4. **Anexos** nas atividades da empresa, usando o mesmo painel de anexos já existente.
5. **Isolamento por empresa**: cada empresa vê e edita somente a própria agenda; a agenda do consultor continua intocada.

## Detalhes técnicos

- Nova tabela `public.company_activities` (company_id, created_by, title, description, activity_date, activity_type, priority, status, responsible, location, meeting_link, reminder, completed_at, deleted_at, created_at, updated_at), com GRANTs para `authenticated`/`service_role`, RLS habilitada e políticas de leitura/escrita via `auth_helpers.user_has_company_access(company_id)`; soft delete por `deleted_at` (nada é removido fisicamente).
- Trigger `tg_set_updated_at` na nova tabela.
- Refatoração leve de `src/routes/app.agenda.tsx`: o componente atual (consultor) é mantido como está; quando `isConsultant` for falso, renderiza um novo componente `CompanyAgenda` (arquivo próprio em `src/components/agenda/CompanyAgenda.tsx`) que reaproveita o mesmo layout de calendário/listas, lendo `company_activities` filtrado pela empresa selecionada (`useSelectedCompany`).
- `src/routes/app.tsx`: acrescentar a entrada `Agenda` em `clientNav` e habilitar o submenu de seções também para o cliente.
