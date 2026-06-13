import { createServerSupabaseClient } from '../supabase/server'

export type TableName = string
export type QueryOptions = {
  select?: string
  eq?: Record<string, unknown>
  neq?: Record<string, unknown>
  gt?: Record<string, unknown>
  gte?: Record<string, unknown>
  lt?: Record<string, unknown>
  lte?: Record<string, unknown>
  like?: Record<string, unknown>
  ilike?: Record<string, unknown>
  in?: Record<string, unknown[]>
  order?: { column: string; ascending?: boolean }
  limit?: number
  offset?: number
}

export type InsertOptions<T> = {
  table: TableName
  data: T
  select?: string
}

export type UpdateOptions = {
  table: TableName
  data: Record<string, unknown>
  filters: QueryOptions
  select?: string
}

export type DeleteOptions = {
  table: TableName
  filters: QueryOptions
}

/**
 * Fetch records from a table
 */
export async function fetchRecords<T>(options: QueryOptions & { table: TableName }): Promise<T[]> {
  const supabase = await createServerSupabaseClient()
  const { table, select = '*', eq, neq, gt, gte, lt, lte, like, ilike, in: inOp, order, limit, offset } = options

  let query = supabase.from(table).select(select)

  if (eq) {
    for (const [column, value] of Object.entries(eq)) {
      query = query.eq(column, value)
    }
  }

  if (neq) {
    for (const [column, value] of Object.entries(neq)) {
      query = query.neq(column, value)
    }
  }

  if (gt) {
    for (const [column, value] of Object.entries(gt)) {
      query = query.gt(column, value)
    }
  }

  if (gte) {
    for (const [column, value] of Object.entries(gte)) {
      query = query.gte(column, value)
    }
  }

  if (lt) {
    for (const [column, value] of Object.entries(lt)) {
      query = query.lt(column, value)
    }
  }

  if (lte) {
    for (const [column, value] of Object.entries(lte)) {
      query = query.lte(column, value)
    }
  }

  if (like) {
    for (const [column, value] of Object.entries(like)) {
      query = query.like(column, value as string)
    }
  }

  if (ilike) {
    for (const [column, value] of Object.entries(ilike)) {
      query = query.ilike(column, value as string)
    }
  }

  if (inOp) {
    for (const [column, value] of Object.entries(inOp)) {
      query = query.in(column, value)
    }
  }

  if (order) {
    query = query.order(order.column, { ascending: order.ascending ?? true })
  }

  if (limit) {
    query = query.limit(limit)
  }

  if (offset) {
    query = query.range(offset, offset + (limit ?? 1000) - 1)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Error fetching records: ${error.message}`)
  }

  return (data ?? []) as T[]
}

/**
 * Fetch a single record by ID
 */
export async function fetchById<T>(options: {
  table: TableName
  id: string
  select?: string
}): Promise<T | null> {
  const supabase = await createServerSupabaseClient()
  const { table, id, select = '*' } = options

  const { data, error } = await supabase.from(table).select(select).eq('id', id).single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Error fetching record: ${error.message}`)
  }

  return data as T
}

/**
 * Insert a new record
 */
export async function insertRecord<T>({ table, data, select = '*' }: InsertOptions<T>): Promise<T> {
  const supabase = await createServerSupabaseClient()

  const { data: result, error } = await supabase.from(table).insert(data as any).select(select).single()

  if (error) {
    throw new Error(`Error inserting record: ${error.message}`)
  }

  return result as T
}

/**
 * Insert multiple records
 */
export async function insertRecords<T>({ table, data, select = '*' }: Omit<InsertOptions<T[]>, 'data'> & { data: T[] }): Promise<T[]> {
  const supabase = await createServerSupabaseClient()

  const { data: result, error } = await supabase.from(table).insert(data as any).select(select)

  if (error) {
    throw new Error(`Error inserting records: ${error.message}`)
  }

  return result as T[]
}

/**
 * Update records
 */
export async function updateRecords<T>({ table, data, filters, select = '*' }: UpdateOptions): Promise<T[]> {
  const supabase = await createServerSupabaseClient()

  let query = supabase.from(table).update(data).select(select)

  const { eq, neq, gt, gte, lt, lte, like, ilike, in: inOp } = filters

  if (eq) {
    for (const [column, value] of Object.entries(eq)) {
      query = query.eq(column, value)
    }
  }

  if (neq) {
    for (const [column, value] of Object.entries(neq)) {
      query = query.neq(column, value)
    }
  }

  if (gt) {
    for (const [column, value] of Object.entries(gt)) {
      query = query.gt(column, value)
    }
  }

  if (gte) {
    for (const [column, value] of Object.entries(gte)) {
      query = query.gte(column, value)
    }
  }

  if (lt) {
    for (const [column, value] of Object.entries(lt)) {
      query = query.lt(column, value)
    }
  }

  if (lte) {
    for (const [column, value] of Object.entries(lte)) {
      query = query.lte(column, value)
    }
  }

  if (like) {
    for (const [column, value] of Object.entries(like)) {
      query = query.like(column, value as string)
    }
  }

  if (ilike) {
    for (const [column, value] of Object.entries(ilike)) {
      query = query.ilike(column, value as string)
    }
  }

  if (inOp) {
    for (const [column, value] of Object.entries(inOp)) {
      query = query.in(column, value)
    }
  }

  const { data: result, error } = await query

  if (error) {
    throw new Error(`Error updating records: ${error.message}`)
  }

  return result as T[]
}

/**
 * Update a single record by ID
 */
export async function updateById<T>(options: {
  table: TableName
  id: string
  data: Record<string, unknown>
  select?: string
}): Promise<T> {
  const supabase = await createServerSupabaseClient()
  const { table, id, data, select = '*' } = options

  const { data: result, error } = await supabase.from(table).update(data).eq('id', id).select(select).single()

  if (error) {
    throw new Error(`Error updating record: ${error.message}`)
  }

  return result as T
}

/**
 * Delete records
 */
export async function deleteRecords({ table, filters }: DeleteOptions): Promise<void> {
  const supabase = await createServerSupabaseClient()

  let query = supabase.from(table).delete()

  const { eq, neq, gt, gte, lt, lte, like, ilike, in: inOp } = filters

  if (eq) {
    for (const [column, value] of Object.entries(eq)) {
      query = query.eq(column, value)
    }
  }

  if (neq) {
    for (const [column, value] of Object.entries(neq)) {
      query = query.neq(column, value)
    }
  }

  if (gt) {
    for (const [column, value] of Object.entries(gt)) {
      query = query.gt(column, value)
    }
  }

  if (gte) {
    for (const [column, value] of Object.entries(gte)) {
      query = query.gte(column, value)
    }
  }

  if (lt) {
    for (const [column, value] of Object.entries(lt)) {
      query = query.lt(column, value)
    }
  }

  if (lte) {
    for (const [column, value] of Object.entries(lte)) {
      query = query.lte(column, value)
    }
  }

  if (like) {
    for (const [column, value] of Object.entries(like)) {
      query = query.like(column, value as string)
    }
  }

  if (ilike) {
    for (const [column, value] of Object.entries(ilike)) {
      query = query.ilike(column, value as string)
    }
  }

  if (inOp) {
    for (const [column, value] of Object.entries(inOp)) {
      query = query.in(column, value)
    }
  }

  const { error } = await query

  if (error) {
    throw new Error(`Error deleting records: ${error.message}`)
  }
}

/**
 * Delete a single record by ID
 */
export async function deleteById({ table, id }: { table: TableName; id: string }): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.from(table).delete().eq('id', id)

  if (error) {
    throw new Error(`Error deleting record: ${error.message}`)
  }
}

/**
 * Count records matching filters
 */
export async function countRecords(
  table: TableName,
  filters?: Omit<QueryOptions, 'select' | 'order' | 'limit' | 'offset'>
): Promise<number> {
  const supabase = await createServerSupabaseClient()

  let query = supabase.from(table).select('*', { count: 'exact', head: true })

  if (filters?.eq) {
    for (const [column, value] of Object.entries(filters.eq)) {
      query = query.eq(column, value)
    }
  }

  if (filters?.neq) {
    for (const [column, value] of Object.entries(filters.neq)) {
      query = query.neq(column, value)
    }
  }

  if (filters?.gt) {
    for (const [column, value] of Object.entries(filters.gt)) {
      query = query.gt(column, value)
    }
  }

  if (filters?.gte) {
    for (const [column, value] of Object.entries(filters.gte)) {
      query = query.gte(column, value)
    }
  }

  if (filters?.lt) {
    for (const [column, value] of Object.entries(filters.lt)) {
      query = query.lt(column, value)
    }
  }

  if (filters?.lte) {
    for (const [column, value] of Object.entries(filters.lte)) {
      query = query.lte(column, value)
    }
  }

  if (filters?.like) {
    for (const [column, value] of Object.entries(filters.like)) {
      query = query.like(column, value as string)
    }
  }

  if (filters?.ilike) {
    for (const [column, value] of Object.entries(filters.ilike)) {
      query = query.ilike(column, value as string)
    }
  }

  if (filters?.in) {
    for (const [column, value] of Object.entries(filters.in)) {
      query = query.in(column, value)
    }
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Error counting records: ${error.message}`)
  }

  return count ?? 0
}
