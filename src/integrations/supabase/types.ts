export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_plan_comments: {
        Row: {
          action_plan_id: string
          attachment_url: string | null
          author_name: string | null
          author_user_id: string
          comment: string
          comment_type: string
          created_at: string
          id: string
        }
        Insert: {
          action_plan_id: string
          attachment_url?: string | null
          author_name?: string | null
          author_user_id: string
          comment: string
          comment_type?: string
          created_at?: string
          id?: string
        }
        Update: {
          action_plan_id?: string
          attachment_url?: string | null
          author_name?: string | null
          author_user_id?: string
          comment?: string
          comment_type?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_comments_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plans: {
        Row: {
          activity_id: string | null
          allow_client_complete: boolean
          allow_client_view: boolean
          branch_id: string | null
          company_id: string
          completed_at: string | null
          completion_notes: string | null
          consultant_id: string
          created_at: string
          created_by: string | null
          description: string | null
          diagnostic_id: string | null
          due_date: string | null
          id: string
          notes: string | null
          origin: string
          priority: string
          related_area: string
          related_module: string | null
          related_record_id: string | null
          responsible_name: string | null
          responsible_type: string
          responsible_user_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          allow_client_complete?: boolean
          allow_client_view?: boolean
          branch_id?: string | null
          company_id: string
          completed_at?: string | null
          completion_notes?: string | null
          consultant_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          diagnostic_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          origin?: string
          priority?: string
          related_area?: string
          related_module?: string | null
          related_record_id?: string | null
          responsible_name?: string | null
          responsible_type?: string
          responsible_user_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          allow_client_complete?: boolean
          allow_client_view?: boolean
          branch_id?: string | null
          company_id?: string
          completed_at?: string | null
          completion_notes?: string | null
          consultant_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          diagnostic_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          origin?: string
          priority?: string
          related_area?: string
          related_module?: string | null
          related_record_id?: string | null
          responsible_name?: string | null
          responsible_type?: string
          responsible_user_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          description: string | null
          document_type: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          related_module: string
          related_record_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          document_type?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          related_module: string
          related_record_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          document_type?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          related_module?: string
          related_record_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          ativa: boolean
          cidade: string | null
          cnpj: string | null
          company_id: string
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          is_main_branch: boolean
          nome: string
          nome_fantasia: string | null
          responsavel: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          cidade?: string | null
          cnpj?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          is_main_branch?: boolean
          nome: string
          nome_fantasia?: string | null
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          cidade?: string | null
          cnpj?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          is_main_branch?: boolean
          nome?: string
          nome_fantasia?: string | null
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          ano: number
          branch_id: string | null
          categoria_id: string
          company_id: string
          created_at: string
          id: string
          mes: number
          observacoes: string | null
          valor_orcado: number
        }
        Insert: {
          ano: number
          branch_id?: string | null
          categoria_id: string
          company_id: string
          created_at?: string
          id?: string
          mes: number
          observacoes?: string | null
          valor_orcado: number
        }
        Update: {
          ano?: number
          branch_id?: string | null
          categoria_id?: string
          company_id?: string
          created_at?: string
          id?: string
          mes?: number
          observacoes?: string | null
          valor_orcado?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          cash_flow_line: string | null
          company_id: string
          created_at: string
          description: string | null
          dre_line: string | null
          financial_classification: string | null
          fixed_or_variable: string | null
          id: string
          impacts_break_even: boolean | null
          impacts_contribution_margin: boolean | null
          impacts_debt: boolean | null
          impacts_ebitda: boolean | null
          impacts_gross_revenue: boolean | null
          impacts_net_profit: boolean | null
          impacts_net_revenue: boolean | null
          impacts_operating_profit: boolean | null
          impacts_working_capital: boolean | null
          is_active: boolean | null
          is_deduction: boolean | null
          is_default: boolean | null
          is_financial_expense: boolean | null
          is_fixed_cost: boolean | null
          is_variable_cost: boolean | null
          kpi_classification: string | null
          management_group: string | null
          nature: string | null
          nome: string
          tipo: Database["public"]["Enums"]["transaction_type"]
          updated_at: string | null
        }
        Insert: {
          cash_flow_line?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          dre_line?: string | null
          financial_classification?: string | null
          fixed_or_variable?: string | null
          id?: string
          impacts_break_even?: boolean | null
          impacts_contribution_margin?: boolean | null
          impacts_debt?: boolean | null
          impacts_ebitda?: boolean | null
          impacts_gross_revenue?: boolean | null
          impacts_net_profit?: boolean | null
          impacts_net_revenue?: boolean | null
          impacts_operating_profit?: boolean | null
          impacts_working_capital?: boolean | null
          is_active?: boolean | null
          is_deduction?: boolean | null
          is_default?: boolean | null
          is_financial_expense?: boolean | null
          is_fixed_cost?: boolean | null
          is_variable_cost?: boolean | null
          kpi_classification?: string | null
          management_group?: string | null
          nature?: string | null
          nome: string
          tipo: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
        }
        Update: {
          cash_flow_line?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          dre_line?: string | null
          financial_classification?: string | null
          fixed_or_variable?: string | null
          id?: string
          impacts_break_even?: boolean | null
          impacts_contribution_margin?: boolean | null
          impacts_debt?: boolean | null
          impacts_ebitda?: boolean | null
          impacts_gross_revenue?: boolean | null
          impacts_net_profit?: boolean | null
          impacts_net_revenue?: boolean | null
          impacts_operating_profit?: boolean | null
          impacts_working_capital?: boolean | null
          is_active?: boolean | null
          is_deduction?: boolean | null
          is_default?: boolean | null
          is_financial_expense?: boolean | null
          is_fixed_cost?: boolean | null
          is_variable_cost?: boolean | null
          kpi_classification?: string | null
          management_group?: string | null
          nature?: string | null
          nome?: string
          tipo?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_pending_items: {
        Row: {
          allow_client_view: boolean
          branch_id: string | null
          company_id: string
          consultant_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          pending_type: string
          priority: string
          related_module: string | null
          related_record_id: string | null
          request_date: string
          requested_by_user_id: string | null
          resolved_at: string | null
          responsible_name: string | null
          responsible_user_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_client_view?: boolean
          branch_id?: string | null
          company_id: string
          consultant_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          pending_type?: string
          priority?: string
          related_module?: string | null
          related_record_id?: string | null
          request_date?: string
          requested_by_user_id?: string | null
          resolved_at?: string | null
          responsible_name?: string | null
          responsible_user_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_client_view?: boolean
          branch_id?: string | null
          company_id?: string
          consultant_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          pending_type?: string
          priority?: string
          related_module?: string | null
          related_record_id?: string | null
          request_date?: string
          requested_by_user_id?: string | null
          resolved_at?: string | null
          responsible_name?: string | null
          responsible_user_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_pending_responses: {
        Row: {
          attachment_url: string | null
          author_name: string | null
          created_at: string
          id: string
          pending_item_id: string
          response_text: string | null
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          author_name?: string | null
          created_at?: string
          id?: string
          pending_item_id: string
          response_text?: string | null
          user_id: string
        }
        Update: {
          attachment_url?: string | null
          author_name?: string | null
          created_at?: string
          id?: string
          pending_item_id?: string
          response_text?: string | null
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          consultancy_progress: number
          consultancy_stage: string
          consultancy_status: string
          consultant_id: string | null
          created_at: string
          data_inicio: string | null
          documento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          owner_id: string
          responsavel: string | null
          segmento: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          consultancy_progress?: number
          consultancy_stage?: string
          consultancy_status?: string
          consultant_id?: string | null
          created_at?: string
          data_inicio?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome: string
          nome_fantasia?: string | null
          observacoes?: string | null
          owner_id: string
          responsavel?: string | null
          segmento?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          consultancy_progress?: number
          consultancy_stage?: string
          consultancy_status?: string
          consultant_id?: string | null
          created_at?: string
          data_inicio?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          owner_id?: string
          responsavel?: string | null
          segmento?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_journey_checklist: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          journey_phase_id: string
          position: number
          related_module: string | null
          related_record_id: string | null
          responsible_type: string
          responsible_user_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          journey_phase_id: string
          position?: number
          related_module?: string | null
          related_record_id?: string | null
          responsible_type?: string
          responsible_user_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          journey_phase_id?: string
          position?: number
          related_module?: string | null
          related_record_id?: string | null
          responsible_type?: string
          responsible_user_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_journey_checklist_journey_phase_id_fkey"
            columns: ["journey_phase_id"]
            isOneToOne: false
            referencedRelation: "company_journey_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      company_journey_deliverables: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          due_date: string | null
          file_url: string | null
          id: string
          journey_phase_id: string
          notes: string | null
          responsible_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          journey_phase_id: string
          notes?: string | null
          responsible_type?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          journey_phase_id?: string
          notes?: string | null
          responsible_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_journey_deliverables_journey_phase_id_fkey"
            columns: ["journey_phase_id"]
            isOneToOne: false
            referencedRelation: "company_journey_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      company_journey_phases: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          journey_id: string
          notes: string | null
          objective: string | null
          phase_key: string
          phase_name: string
          phase_order: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          journey_id: string
          notes?: string | null
          objective?: string | null
          phase_key: string
          phase_name: string
          phase_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          journey_id?: string
          notes?: string | null
          objective?: string | null
          phase_key?: string
          phase_name?: string
          phase_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_journey_phases_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "company_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      company_journeys: {
        Row: {
          allow_client_view: boolean
          branch_id: string | null
          company_id: string
          consultant_id: string
          created_at: string
          current_phase_id: string | null
          id: string
          notes: string | null
          overall_progress: number
          start_date: string
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          allow_client_view?: boolean
          branch_id?: string | null
          company_id: string
          consultant_id: string
          created_at?: string
          current_phase_id?: string | null
          id?: string
          notes?: string | null
          overall_progress?: number
          start_date?: string
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_client_view?: boolean
          branch_id?: string | null
          company_id?: string
          consultant_id?: string
          created_at?: string
          current_phase_id?: string | null
          id?: string
          notes?: string | null
          overall_progress?: number
          start_date?: string
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      consultancy_activities: {
        Row: {
          activity_date: string
          activity_type: string
          branch_id: string | null
          canceled_at: string | null
          company_id: string | null
          completed_at: string | null
          consultant_id: string
          created_at: string
          description: string | null
          due_date: string | null
          end_time: string | null
          id: string
          location: string | null
          meeting_link: string | null
          notes: string | null
          priority: string
          recurrence_type: string
          recurrence_until: string | null
          related_module: string | null
          related_record_id: string | null
          reminder_datetime: string | null
          reminder_type: string | null
          responsible_name: string | null
          start_time: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          activity_date?: string
          activity_type?: string
          branch_id?: string | null
          canceled_at?: string | null
          company_id?: string | null
          completed_at?: string | null
          consultant_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          priority?: string
          recurrence_type?: string
          recurrence_until?: string | null
          related_module?: string | null
          related_record_id?: string | null
          reminder_datetime?: string | null
          reminder_type?: string | null
          responsible_name?: string | null
          start_time?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          activity_date?: string
          activity_type?: string
          branch_id?: string | null
          canceled_at?: string | null
          company_id?: string | null
          completed_at?: string | null
          consultant_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          priority?: string
          recurrence_type?: string
          recurrence_until?: string | null
          related_module?: string | null
          related_record_id?: string | null
          reminder_datetime?: string | null
          reminder_type?: string | null
          responsible_name?: string | null
          start_time?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      consultancy_contracts: {
        Row: {
          client_name: string | null
          company_id: string | null
          consultant_id: string
          created_at: string
          due_day: number
          end_date: string | null
          id: string
          monthly_amount: number
          notes: string | null
          payment_method: string | null
          plan_name: string | null
          service_type: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          company_id?: string | null
          consultant_id: string
          created_at?: string
          due_day?: number
          end_date?: string | null
          id?: string
          monthly_amount?: number
          notes?: string | null
          payment_method?: string | null
          plan_name?: string | null
          service_type?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          company_id?: string | null
          consultant_id?: string
          created_at?: string
          due_day?: number
          end_date?: string | null
          id?: string
          monthly_amount?: number
          notes?: string | null
          payment_method?: string | null
          plan_name?: string | null
          service_type?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultancy_contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultancy_contracts_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      consultancy_journey_stages: {
        Row: {
          consultant_id: string
          created_at: string
          id: string
          is_terminal: boolean
          label: string
          position: number
          stage_key: string
          updated_at: string
        }
        Insert: {
          consultant_id: string
          created_at?: string
          id?: string
          is_terminal?: boolean
          label: string
          position?: number
          stage_key: string
          updated_at?: string
        }
        Update: {
          consultant_id?: string
          created_at?: string
          id?: string
          is_terminal?: boolean
          label?: string
          position?: number
          stage_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      consultancy_journey_template_checklist: {
        Row: {
          created_at: string
          description: string | null
          id: string
          position: number
          responsible_type: string
          suggested_due_days: number | null
          template_phase_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          responsible_type?: string
          suggested_due_days?: number | null
          template_phase_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          responsible_type?: string
          suggested_due_days?: number | null
          template_phase_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultancy_journey_template_checklist_template_phase_id_fkey"
            columns: ["template_phase_id"]
            isOneToOne: false
            referencedRelation: "consultancy_journey_template_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      consultancy_journey_template_phases: {
        Row: {
          created_at: string
          description: string | null
          id: string
          objective: string | null
          phase_key: string
          phase_name: string
          phase_order: number
          suggested_duration_days: number | null
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          objective?: string | null
          phase_key: string
          phase_name: string
          phase_order?: number
          suggested_duration_days?: number | null
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          objective?: string | null
          phase_key?: string
          phase_name?: string
          phase_order?: number
          suggested_duration_days?: number | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultancy_journey_template_phases_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "consultancy_journey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      consultancy_journey_templates: {
        Row: {
          consultant_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          consultant_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          consultant_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      consultancy_payables: {
        Row: {
          amount: number
          attachment_path: string | null
          category: string | null
          consultant_id: string
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          attachment_path?: string | null
          category?: string | null
          consultant_id: string
          created_at?: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          attachment_path?: string | null
          category?: string | null
          consultant_id?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultancy_payables_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      consultancy_receivables: {
        Row: {
          amount: number
          client_name: string | null
          company_id: string | null
          consultant_id: string
          contract_id: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          payment_method: string | null
          received_date: string | null
          revenue_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_name?: string | null
          company_id?: string | null
          consultant_id: string
          contract_id?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          received_date?: string | null
          revenue_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_name?: string | null
          company_id?: string | null
          consultant_id?: string
          contract_id?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          received_date?: string | null
          revenue_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultancy_receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultancy_receivables_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultancy_receivables_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "consultancy_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      consultancy_stage_history: {
        Row: {
          changed_by: string | null
          company_id: string
          consultant_id: string
          created_at: string
          id: string
          new_stage: string
          notes: string | null
          previous_stage: string | null
        }
        Insert: {
          changed_by?: string | null
          company_id: string
          consultant_id: string
          created_at?: string
          id?: string
          new_stage: string
          notes?: string | null
          previous_stage?: string | null
        }
        Update: {
          changed_by?: string | null
          company_id?: string
          consultant_id?: string
          created_at?: string
          id?: string
          new_stage?: string
          notes?: string | null
          previous_stage?: string | null
        }
        Relationships: []
      }
      consultancy_transactions: {
        Row: {
          amount: number
          category: string | null
          consultant_id: string
          created_at: string
          description: string
          due_date: string | null
          id: string
          notes: string | null
          payable_id: string | null
          payment_date: string | null
          payment_method: string | null
          receivable_id: string | null
          related_company_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          consultant_id: string
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          notes?: string | null
          payable_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          receivable_id?: string | null
          related_company_id?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          consultant_id?: string
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          payable_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          receivable_id?: string | null
          related_company_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultancy_transactions_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultancy_transactions_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "consultancy_payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultancy_transactions_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "consultancy_receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultancy_transactions_related_company_id_fkey"
            columns: ["related_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_company_links: {
        Row: {
          company_id: string
          consultant_id: string
          created_at: string
          id: string
          linked_at: string | null
          notes: string | null
          requested_by: string | null
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          consultant_id: string
          created_at?: string
          id?: string
          linked_at?: string | null
          notes?: string | null
          requested_by?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          consultant_id?: string
          created_at?: string
          id?: string
          linked_at?: string | null
          notes?: string | null
          requested_by?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_company_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_company_links_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_library_template_usage: {
        Row: {
          branch_id: string | null
          company_id: string | null
          consultant_id: string
          created_at: string
          created_by: string | null
          generated_content: string | null
          generated_title: string
          id: string
          period: string | null
          related_module: string | null
          related_record_id: string | null
          shared_with_client: boolean
          status: string
          template_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          consultant_id: string
          created_at?: string
          created_by?: string | null
          generated_content?: string | null
          generated_title: string
          id?: string
          period?: string | null
          related_module?: string | null
          related_record_id?: string | null
          shared_with_client?: boolean
          status?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          consultant_id?: string
          created_at?: string
          created_by?: string | null
          generated_content?: string | null
          generated_title?: string
          id?: string
          period?: string | null
          related_module?: string | null
          related_record_id?: string | null
          shared_with_client?: boolean
          status?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_library_template_usage_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "consultant_library_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_library_template_versions: {
        Row: {
          change_note: string | null
          changed_by: string | null
          content_snapshot: string | null
          created_at: string
          id: string
          template_id: string
        }
        Insert: {
          change_note?: string | null
          changed_by?: string | null
          content_snapshot?: string | null
          created_at?: string
          id?: string
          template_id: string
        }
        Update: {
          change_note?: string | null
          changed_by?: string | null
          content_snapshot?: string | null
          created_at?: string
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_library_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "consultant_library_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_library_templates: {
        Row: {
          category: string
          consultant_id: string
          content: string | null
          created_at: string
          created_by: string | null
          description: string | null
          file_url: string | null
          id: string
          is_default: boolean
          schema_fields: Json
          status: string
          tags: string[]
          template_type: string
          title: string
          updated_at: string
          usage_count: number
          visibility: string
        }
        Insert: {
          category?: string
          consultant_id: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          is_default?: boolean
          schema_fields?: Json
          status?: string
          tags?: string[]
          template_type?: string
          title: string
          updated_at?: string
          usage_count?: number
          visibility?: string
        }
        Update: {
          category?: string
          consultant_id?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          is_default?: boolean
          schema_fields?: Json
          status?: string
          tags?: string[]
          template_type?: string
          title?: string
          updated_at?: string
          usage_count?: number
          visibility?: string
        }
        Relationships: []
      }
      consultants: {
        Row: {
          city: string | null
          consultancy_cnpj: string | null
          consultancy_name: string
          created_at: string
          email: string | null
          id: string
          invite_code: string
          is_active: boolean
          logo_url: string | null
          phone: string | null
          responsible_name: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          consultancy_cnpj?: string | null
          consultancy_name: string
          created_at?: string
          email?: string | null
          id?: string
          invite_code: string
          is_active?: boolean
          logo_url?: string | null
          phone?: string | null
          responsible_name?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          consultancy_cnpj?: string | null
          consultancy_name?: string
          created_at?: string
          email?: string | null
          id?: string
          invite_code?: string
          is_active?: boolean
          logo_url?: string | null
          phone?: string | null
          responsible_name?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          branch_id: string | null
          center_type: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          kpi_classification: string | null
          nome: string
          responsible: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          center_type?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          kpi_classification?: string | null
          nome: string
          responsible?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          center_type?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          kpi_classification?: string | null
          nome?: string
          responsible?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          address: string | null
          branch_id: string | null
          city: string | null
          company_id: string
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          lead_source: string | null
          name: string
          notes: string | null
          phone: string | null
          responsible: string | null
          state: string | null
          status: string
          tipo: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          city?: string | null
          company_id: string
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lead_source?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          responsible?: string | null
          state?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          city?: string | null
          company_id?: string
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lead_source?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          responsible?: string | null
          state?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      executive_reports: {
        Row: {
          ano: number
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          diagnostico: string | null
          id: string
          mes: number
          observacoes: string | null
          plano_acao: string | null
          problemas: string | null
          recomendacoes: string | null
          updated_at: string
        }
        Insert: {
          ano: number
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          diagnostico?: string | null
          id?: string
          mes: number
          observacoes?: string | null
          plano_acao?: string | null
          problemas?: string | null
          recomendacoes?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          diagnostico?: string | null
          id?: string
          mes?: number
          observacoes?: string | null
          plano_acao?: string | null
          problemas?: string | null
          recomendacoes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financial_accounts: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          id: string
          nome: string
          saldo_inicial: number
          tipo: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          id?: string
          nome: string
          saldo_inicial?: number
          tipo?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          id?: string
          nome?: string
          saldo_inicial?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_diagnostic_answers: {
        Row: {
          answer: string | null
          created_at: string
          diagnostic_id: string
          id: string
          notes: string | null
          question: string
          question_key: string
          score: number
          section: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          diagnostic_id: string
          id?: string
          notes?: string | null
          question: string
          question_key: string
          score?: number
          section: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          diagnostic_id?: string
          id?: string
          notes?: string | null
          question?: string
          question_key?: string
          score?: number
          section?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_diagnostic_answers_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "financial_diagnostics"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_diagnostics: {
        Row: {
          allow_client_view: boolean
          avg_monthly_revenue: string | null
          branch_id: string | null
          business_city: string | null
          business_email: string | null
          business_phone: string | null
          business_segment: string | null
          classification: string | null
          company_id: string | null
          consultant_id: string
          created_at: string
          diagnostic_date: string
          employee_count: string | null
          finalized_at: string | null
          id: string
          next_steps: string | null
          notes: string | null
          overall_score: number
          prospect_name: string | null
          prospect_responsible: string | null
          recommendations: string | null
          responsible_name: string | null
          status: string
          strengths: string | null
          total_points: number | null
          updated_at: string
          weaknesses: string | null
        }
        Insert: {
          allow_client_view?: boolean
          avg_monthly_revenue?: string | null
          branch_id?: string | null
          business_city?: string | null
          business_email?: string | null
          business_phone?: string | null
          business_segment?: string | null
          classification?: string | null
          company_id?: string | null
          consultant_id: string
          created_at?: string
          diagnostic_date?: string
          employee_count?: string | null
          finalized_at?: string | null
          id?: string
          next_steps?: string | null
          notes?: string | null
          overall_score?: number
          prospect_name?: string | null
          prospect_responsible?: string | null
          recommendations?: string | null
          responsible_name?: string | null
          status?: string
          strengths?: string | null
          total_points?: number | null
          updated_at?: string
          weaknesses?: string | null
        }
        Update: {
          allow_client_view?: boolean
          avg_monthly_revenue?: string | null
          branch_id?: string | null
          business_city?: string | null
          business_email?: string | null
          business_phone?: string | null
          business_segment?: string | null
          classification?: string | null
          company_id?: string | null
          consultant_id?: string
          created_at?: string
          diagnostic_date?: string
          employee_count?: string | null
          finalized_at?: string | null
          id?: string
          next_steps?: string | null
          notes?: string | null
          overall_score?: number
          prospect_name?: string | null
          prospect_responsible?: string | null
          recommendations?: string | null
          responsible_name?: string | null
          status?: string
          strengths?: string | null
          total_points?: number | null
          updated_at?: string
          weaknesses?: string | null
        }
        Relationships: []
      }
      generated_document_attachments: {
        Row: {
          created_at: string
          document_id: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_document_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_document_versions: {
        Row: {
          change_note: string | null
          changed_by: string | null
          content_snapshot: string | null
          created_at: string
          document_id: string
          form_data_snapshot: Json | null
          id: string
        }
        Insert: {
          change_note?: string | null
          changed_by?: string | null
          content_snapshot?: string | null
          created_at?: string
          document_id: string
          form_data_snapshot?: Json | null
          id?: string
        }
        Update: {
          change_note?: string | null
          changed_by?: string | null
          content_snapshot?: string | null
          created_at?: string
          document_id?: string
          form_data_snapshot?: Json | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          branch_id: string | null
          company_id: string | null
          consultant_id: string
          created_at: string
          created_by: string | null
          document_type: string
          final_content: string | null
          finalized_at: string | null
          form_data: Json
          generated_content: string | null
          id: string
          pdf_url: string | null
          shared_with_client: boolean
          signature_status: string
          status: string
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          consultant_id: string
          created_at?: string
          created_by?: string | null
          document_type: string
          final_content?: string | null
          finalized_at?: string | null
          form_data?: Json
          generated_content?: string | null
          id?: string
          pdf_url?: string | null
          shared_with_client?: boolean
          signature_status?: string
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          consultant_id?: string
          created_at?: string
          created_by?: string | null
          document_type?: string
          final_content?: string | null
          finalized_at?: string | null
          form_data?: Json
          generated_content?: string | null
          id?: string
          pdf_url?: string | null
          shared_with_client?: boolean
          signature_status?: string
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          branch_id: string | null
          company_id: string
          duplicate_rows: number
          error_rows: number
          file_format: string | null
          file_name: string | null
          id: string
          ignored_rows: number
          import_type: string
          imported_at: string
          imported_rows: number
          notes: string | null
          reconciled_rows: number
          status: string
          total_rows: number
          undone_at: string | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          duplicate_rows?: number
          error_rows?: number
          file_format?: string | null
          file_name?: string | null
          id?: string
          ignored_rows?: number
          import_type: string
          imported_at?: string
          imported_rows?: number
          notes?: string | null
          reconciled_rows?: number
          status?: string
          total_rows?: number
          undone_at?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          duplicate_rows?: number
          error_rows?: number
          file_format?: string | null
          file_name?: string | null
          id?: string
          ignored_rows?: number
          import_type?: string
          imported_at?: string
          imported_rows?: number
          notes?: string | null
          reconciled_rows?: number
          status?: string
          total_rows?: number
          undone_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      import_rules: {
        Row: {
          category_id: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kpi_actions: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          id: string
          nome: string
          observacoes: string | null
          retorno_obtido: number
          tipo: string | null
          updated_at: string
          valor_investido: number
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          retorno_obtido?: number
          tipo?: string | null
          updated_at?: string
          valor_investido?: number
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          retorno_obtido?: number
          tipo?: string | null
          updated_at?: string
          valor_investido?: number
        }
        Relationships: []
      }
      kpi_assumptions: {
        Row: {
          amortizacao: number
          company_id: string
          compras_medias_cliente: number
          depreciacao: number
          novos_clientes: number
          tempo_medio_meses: number
          updated_at: string
        }
        Insert: {
          amortizacao?: number
          company_id: string
          compras_medias_cliente?: number
          depreciacao?: number
          novos_clientes?: number
          tempo_medio_meses?: number
          updated_at?: string
        }
        Update: {
          amortizacao?: number
          company_id?: string
          compras_medias_cliente?: number
          depreciacao?: number
          novos_clientes?: number
          tempo_medio_meses?: number
          updated_at?: string
        }
        Relationships: []
      }
      meeting_minutes: {
        Row: {
          agenda_activity_id: string | null
          agenda_text: string | null
          ai_generated: boolean
          attachments_summary: string | null
          branch_id: string | null
          company_id: string
          consultant_id: string
          created_at: string
          created_by: string | null
          final_content: string | null
          finalized_at: string | null
          generated_content: string | null
          id: string
          meeting_date: string
          meeting_time: string | null
          meeting_type: string
          next_meeting_date: string | null
          participants: Json
          raw_notes: string | null
          related_module: string | null
          related_record_id: string | null
          shared_with_client: boolean
          status: string
          template_used: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agenda_activity_id?: string | null
          agenda_text?: string | null
          ai_generated?: boolean
          attachments_summary?: string | null
          branch_id?: string | null
          company_id: string
          consultant_id: string
          created_at?: string
          created_by?: string | null
          final_content?: string | null
          finalized_at?: string | null
          generated_content?: string | null
          id?: string
          meeting_date?: string
          meeting_time?: string | null
          meeting_type?: string
          next_meeting_date?: string | null
          participants?: Json
          raw_notes?: string | null
          related_module?: string | null
          related_record_id?: string | null
          shared_with_client?: boolean
          status?: string
          template_used?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agenda_activity_id?: string | null
          agenda_text?: string | null
          ai_generated?: boolean
          attachments_summary?: string | null
          branch_id?: string | null
          company_id?: string
          consultant_id?: string
          created_at?: string
          created_by?: string | null
          final_content?: string | null
          finalized_at?: string | null
          generated_content?: string | null
          id?: string
          meeting_date?: string
          meeting_time?: string | null
          meeting_type?: string
          next_meeting_date?: string | null
          participants?: Json
          raw_notes?: string | null
          related_module?: string | null
          related_record_id?: string | null
          shared_with_client?: boolean
          status?: string
          template_used?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_minutes_tasks: {
        Row: {
          created_action_plan_id: string | null
          created_activity_id: string | null
          created_at: string
          created_pending_item_id: string | null
          description: string | null
          due_date: string | null
          id: string
          meeting_minutes_id: string
          responsible_name: string | null
          responsible_type: string
          responsible_user_id: string | null
          status: string
          title: string
        }
        Insert: {
          created_action_plan_id?: string | null
          created_activity_id?: string | null
          created_at?: string
          created_pending_item_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_minutes_id: string
          responsible_name?: string | null
          responsible_type?: string
          responsible_user_id?: string | null
          status?: string
          title: string
        }
        Update: {
          created_action_plan_id?: string | null
          created_activity_id?: string | null
          created_at?: string
          created_pending_item_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_minutes_id?: string
          responsible_name?: string | null
          responsible_type?: string
          responsible_user_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_tasks_meeting_minutes_id_fkey"
            columns: ["meeting_minutes_id"]
            isOneToOne: false
            referencedRelation: "meeting_minutes"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          branch_id: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          company_id: string
          conta_id: string | null
          created_at: string
          data_pagamento: string | null
          descricao: string
          forma_pagamento: string | null
          fornecedor: string | null
          id: string
          import_batch_id: string | null
          observacoes: string | null
          parcelas: number | null
          recorrencia: Database["public"]["Enums"]["recurrence"] | null
          status: Database["public"]["Enums"]["payable_status"]
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          branch_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          company_id: string
          conta_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          descricao: string
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          import_batch_id?: string | null
          observacoes?: string | null
          parcelas?: number | null
          recorrencia?: Database["public"]["Enums"]["recurrence"] | null
          status?: Database["public"]["Enums"]["payable_status"]
          updated_at?: string
          valor: number
          vencimento: string
        }
        Update: {
          branch_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          company_id?: string
          conta_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          descricao?: string
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          import_batch_id?: string | null
          observacoes?: string | null
          parcelas?: number | null
          recorrencia?: Database["public"]["Enums"]["recurrence"] | null
          status?: Database["public"]["Enums"]["payable_status"]
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_records: {
        Row: {
          branch_id: string | null
          categoria: string | null
          comissao: number
          company_id: string
          created_at: string
          created_by: string | null
          custo_compra: number
          custo_embalagem: number
          custo_frete: number
          custo_mao_obra: number
          custo_materia_prima: number
          desconto_medio: number
          id: string
          impostos: number
          margem_atual: number
          margem_desejada: number
          marketplace: number
          markup: number
          nome: string
          observacoes: string | null
          outras_despesas_variaveis: number
          outros_custos_diretos: number
          preco_atual: number
          preco_minimo: number
          preco_sugerido: number
          product_id: string | null
          rateio_administrativo: number
          rateio_comercial: number
          rateio_fixo: number
          taxa_cartao: number
          unidade: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          categoria?: string | null
          comissao?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          custo_compra?: number
          custo_embalagem?: number
          custo_frete?: number
          custo_mao_obra?: number
          custo_materia_prima?: number
          desconto_medio?: number
          id?: string
          impostos?: number
          margem_atual?: number
          margem_desejada?: number
          marketplace?: number
          markup?: number
          nome: string
          observacoes?: string | null
          outras_despesas_variaveis?: number
          outros_custos_diretos?: number
          preco_atual?: number
          preco_minimo?: number
          preco_sugerido?: number
          product_id?: string | null
          rateio_administrativo?: number
          rateio_comercial?: number
          rateio_fixo?: number
          taxa_cartao?: number
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          categoria?: string | null
          comissao?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          custo_compra?: number
          custo_embalagem?: number
          custo_frete?: number
          custo_mao_obra?: number
          custo_materia_prima?: number
          desconto_medio?: number
          id?: string
          impostos?: number
          margem_atual?: number
          margem_desejada?: number
          marketplace?: number
          markup?: number
          nome?: string
          observacoes?: string | null
          outras_despesas_variaveis?: number
          outros_custos_diretos?: number
          preco_atual?: number
          preco_minimo?: number
          preco_sugerido?: number
          product_id?: string | null
          rateio_administrativo?: number
          rateio_comercial?: number
          rateio_fixo?: number
          taxa_cartao?: number
          unidade?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      privacy_policy_versions: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          version_text: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          id?: string
          version_text: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          version_text?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          branch_id: string | null
          categoria: string | null
          centro_custo_id: string | null
          company_id: string
          created_at: string
          custo_unitario: number
          estoque_minimo: number
          fornecedor: string | null
          id: string
          import_batch_id: string | null
          nome: string
          preco_venda: number
          quantidade: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          categoria?: string | null
          centro_custo_id?: string | null
          company_id: string
          created_at?: string
          custo_unitario?: number
          estoque_minimo?: number
          fornecedor?: string | null
          id?: string
          import_batch_id?: string | null
          nome: string
          preco_venda?: number
          quantidade?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          categoria?: string | null
          centro_custo_id?: string | null
          company_id?: string
          created_at?: string
          custo_unitario?: number
          estoque_minimo?: number
          fornecedor?: string | null
          id?: string
          import_batch_id?: string | null
          nome?: string
          preco_venda?: number
          quantidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      receivables: {
        Row: {
          branch_id: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          cliente: string | null
          commission_value: number | null
          company_id: string
          conta_id: string | null
          created_at: string
          crm_contact_id: string | null
          data_recebimento: string | null
          descricao: string
          forma_recebimento: string | null
          id: string
          import_batch_id: string | null
          observacoes: string | null
          parcelas: number | null
          recorrencia: Database["public"]["Enums"]["recurrence"] | null
          reseller_id: string | null
          status: Database["public"]["Enums"]["receivable_status"]
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          branch_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente?: string | null
          commission_value?: number | null
          company_id: string
          conta_id?: string | null
          created_at?: string
          crm_contact_id?: string | null
          data_recebimento?: string | null
          descricao: string
          forma_recebimento?: string | null
          id?: string
          import_batch_id?: string | null
          observacoes?: string | null
          parcelas?: number | null
          recorrencia?: Database["public"]["Enums"]["recurrence"] | null
          reseller_id?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          updated_at?: string
          valor: number
          vencimento: string
        }
        Update: {
          branch_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente?: string | null
          commission_value?: number | null
          company_id?: string
          conta_id?: string | null
          created_at?: string
          crm_contact_id?: string | null
          data_recebimento?: string | null
          descricao?: string
          forma_recebimento?: string | null
          id?: string
          import_batch_id?: string | null
          observacoes?: string | null
          parcelas?: number | null
          recorrencia?: Database["public"]["Enums"]["recurrence"] | null
          reseller_id?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          ativo: boolean
          commission_pct: number
          company_id: string
          created_at: string
          documento: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          stock_location_id: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          commission_pct?: number
          company_id: string
          created_at?: string
          documento?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          stock_location_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          commission_pct?: number
          company_id?: string
          created_at?: string
          documento?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          stock_location_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resellers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resellers_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      stock_locations: {
        Row: {
          ativa: boolean
          branch_id: string | null
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          nome: string
          observacoes: string | null
          responsavel: string | null
          tipo: Database["public"]["Enums"]["stock_location_type"]
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          branch_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          nome: string
          observacoes?: string | null
          responsavel?: string | null
          tipo?: Database["public"]["Enums"]["stock_location_type"]
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          branch_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          nome?: string
          observacoes?: string | null
          responsavel?: string | null
          tipo?: Database["public"]["Enums"]["stock_location_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          custo_unitario: number | null
          data: string
          id: string
          import_batch_id: string | null
          motivo: string | null
          observacoes: string | null
          product_id: string
          quantidade: number
          stock_location_id: string | null
          tipo: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          custo_unitario?: number | null
          data?: string
          id?: string
          import_batch_id?: string | null
          motivo?: string | null
          observacoes?: string | null
          product_id: string
          quantidade: number
          stock_location_id?: string | null
          tipo: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          custo_unitario?: number | null
          data?: string
          id?: string
          import_batch_id?: string | null
          motivo?: string | null
          observacoes?: string | null
          product_id?: string
          quantidade?: number
          stock_location_id?: string | null
          tipo?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_of_service: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          version: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          version: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          version?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          branch_id: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          commission_value: number | null
          company_id: string
          conta_id: string | null
          created_at: string
          crm_contact_id: string | null
          data: string
          descricao: string
          forma_pagamento: string | null
          id: string
          import_batch_id: string | null
          observacoes: string | null
          payable_id: string | null
          receivable_id: string | null
          reconciled_with_id: string | null
          reconciled_with_type: string | null
          reconciliation_status: string | null
          reseller_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          tipo: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          valor: number
        }
        Insert: {
          branch_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          commission_value?: number | null
          company_id: string
          conta_id?: string | null
          created_at?: string
          crm_contact_id?: string | null
          data?: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          import_batch_id?: string | null
          observacoes?: string | null
          payable_id?: string | null
          receivable_id?: string | null
          reconciled_with_id?: string | null
          reconciled_with_type?: string | null
          reconciliation_status?: string | null
          reseller_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tipo: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          valor: number
        }
        Update: {
          branch_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          commission_value?: number | null
          company_id?: string
          conta_id?: string | null
          created_at?: string
          crm_contact_id?: string | null
          data?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          import_batch_id?: string | null
          observacoes?: string | null
          payable_id?: string | null
          receivable_id?: string | null
          reconciled_with_id?: string | null
          reconciled_with_type?: string | null
          reconciliation_status?: string | null
          reseller_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tipo?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_security_settings: {
        Row: {
          id: string
          marketing_accepted: boolean | null
          privacy_policy_accepted_at: string | null
          session_timeout_minutes: number | null
          two_factor_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          marketing_accepted?: boolean | null
          privacy_policy_accepted_at?: string | null
          session_timeout_minutes?: number | null
          two_factor_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          marketing_accepted?: boolean | null
          privacy_policy_accepted_at?: string | null
          session_timeout_minutes?: number | null
          two_factor_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attachment_company_from_path: { Args: { _name: string }; Returns: string }
      find_consultant_by_code: {
        Args: { _code: string }
        Returns: {
          city: string
          consultancy_name: string
          id: string
          responsible_name: string
          state: string
        }[]
      }
      gen_invite_code: { Args: { _seed: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      product_stock_by_location: {
        Args: { _location_id: string; _product_id: string }
        Returns: number
      }
      search_consultants: {
        Args: { _q: string }
        Returns: {
          city: string
          consultancy_name: string
          id: string
          responsible_name: string
          state: string
        }[]
      }
      seed_default_cost_centers: {
        Args: { _company_id: string }
        Returns: undefined
      }
      seed_demo_data: { Args: { _owner: string }; Returns: undefined }
    }
    Enums: {
      app_role: "consultant" | "client_manager" | "operator"
      payable_status: "em_aberto" | "pago" | "vencido"
      receivable_status: "em_aberto" | "recebido" | "vencido"
      recurrence: "unica" | "semanal" | "mensal" | "anual"
      stock_location_type:
        | "principal"
        | "deposito"
        | "loja"
        | "filial"
        | "revendedor"
        | "consignado"
        | "producao"
        | "transito"
        | "outros"
      transaction_status: "realizado" | "pendente" | "previsto"
      transaction_type: "entrada" | "saida"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["consultant", "client_manager", "operator"],
      payable_status: ["em_aberto", "pago", "vencido"],
      receivable_status: ["em_aberto", "recebido", "vencido"],
      recurrence: ["unica", "semanal", "mensal", "anual"],
      stock_location_type: [
        "principal",
        "deposito",
        "loja",
        "filial",
        "revendedor",
        "consignado",
        "producao",
        "transito",
        "outros",
      ],
      transaction_status: ["realizado", "pendente", "previsto"],
      transaction_type: ["entrada", "saida"],
    },
  },
} as const
