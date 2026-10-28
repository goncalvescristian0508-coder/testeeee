import type { Endereco } from './types'

/** Busca endereço pelo CEP no ViaCEP. Devolve null se não encontrar ou sem rede. */
export async function buscarCep(cep: string): Promise<Partial<Endereco> | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!res.ok) return null
    const j = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
    if (j.erro) return null
    return { logradouro: j.logradouro ?? '', bairro: j.bairro ?? '', cidade: j.localidade ?? '', uf: j.uf ?? '' }
  } catch {
    return null
  }
}
