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
          company_id: string
          created_at: string
          id: string
          kpi_classification: string | null
          nome: string
          tipo: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          kpi_classification?: string | null
          nome: string
          tipo: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          kpi_classification?: string | null
          nome?: string
          tipo?: Database["public"]["Enums"]["transaction_type"]
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
      companies: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
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
          company_id: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      products: {
        Row: {
          branch_id: string | null
          categoria: string | null
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
          company_id: string
          conta_id: string | null
          created_at: string
          data_recebimento: string | null
          descricao: string
          forma_recebimento: string | null
          id: string
          import_batch_id: string | null
          observacoes: string | null
          parcelas: number | null
          recorrencia: Database["public"]["Enums"]["recurrence"] | null
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
          company_id: string
          conta_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          descricao: string
          forma_recebimento?: string | null
          id?: string
          import_batch_id?: string | null
          observacoes?: string | null
          parcelas?: number | null
          recorrencia?: Database["public"]["Enums"]["recurrence"] | null
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
          company_id?: string
          conta_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          descricao?: string
          forma_recebimento?: string | null
          id?: string
          import_batch_id?: string | null
          observacoes?: string | null
          parcelas?: number | null
          recorrencia?: Database["public"]["Enums"]["recurrence"] | null
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
        ]
      }
      transactions: {
        Row: {
          branch_id: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          company_id: string
          conta_id: string | null
          created_at: string
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
          status: Database["public"]["Enums"]["transaction_status"]
          tipo: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          valor: number
        }
        Insert: {
          branch_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          company_id: string
          conta_id?: string | null
          created_at?: string
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
          status?: Database["public"]["Enums"]["transaction_status"]
          tipo: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          valor: number
        }
        Update: {
          branch_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          company_id?: string
          conta_id?: string | null
          created_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      is_consultant: { Args: { _user_id: string }; Returns: boolean }
      search_consultants: {
        Args: { _q: string }
        Returns: {
          city: string
          consultancy_name: string
          email: string
          id: string
          invite_code: string
          responsible_name: string
          state: string
        }[]
      }
      seed_demo_data: { Args: { _owner: string }; Returns: undefined }
      user_has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "consultant" | "client_manager" | "operator"
      payable_status: "em_aberto" | "pago" | "vencido"
      receivable_status: "em_aberto" | "recebido" | "vencido"
      recurrence: "unica" | "semanal" | "mensal" | "anual"
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
      transaction_status: ["realizado", "pendente", "previsto"],
      transaction_type: ["entrada", "saida"],
    },
  },
} as const
