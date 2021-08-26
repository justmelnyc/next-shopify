import React from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import { useToggleState, ToggleState } from './utils'

type LineItem = {
  id: string
  title: string
  quantity: number
  variant: {
    image: { src: string; altText?: string }
    price: string
    selectedOptions: { name: string; value: string }[]
  }
}

export type Cart = Omit<any, 'checkoutUrl' | 'lineItems'> & {
  webUrl: string
  lineItems: LineItem[]
}

type Context = {
  cartToggleState: ToggleState
  cart: Cart | undefined
  onAddLineItem: (vars: {
    variantId: string
    quantity: number
  }) => Promise<void>
  onRemoveLineItem: (vars: { variantId: string }) => Promise<void>
  onUpdateLineItem: (vars: {
    variantId: string
    quantity: number
  }) => Promise<void>
}

const ShopifyContext = React.createContext<Context | undefined>(undefined)

const getQueryKey = (checkoutId: string | null) => ['checkout', checkoutId]

export const ShopifyContextProvider = ({
  children
}: {
  children?: React.ReactNode
}) => {
  const cartToggleState = useToggleState()
  const [localStorageCheckoutId, setLocalStorageCheckoutId] = React.useState<
    string | null
  >(null)
  const queryClient = useQueryClient()

  const queryKey = React.useMemo(() => getQueryKey(localStorageCheckoutId), [
    localStorageCheckoutId
  ])

  React.useEffect(() => {
    const checkoutId = localStorage.getItem('checkout-id')
    if (checkoutId) setLocalStorageCheckoutId(checkoutId)
    else {
      fetch('/api/checkout').then(async res => {
        const { checkout } = await res.json()
        const checkoutId = checkout.id.toString()
        queryClient.setQueryData(['checkout', checkoutId], checkout)
        localStorage.setItem('checkout-id', checkoutId)
        setLocalStorageCheckoutId(checkoutId)
      })
    }
  }, [queryClient])

  const { data: cart } = useQuery<Cart>(queryKey, {
    enabled: !!localStorageCheckoutId,
    queryFn: async () => {
      const res = await fetch(`/api/checkout/${localStorageCheckoutId}`)
      const { checkout } = await res.json()
      const checkoutId = checkout.id.toString()
      if (checkoutId !== localStorageCheckoutId) {
        // the checkout was invalid
        localStorage.setItem('checkout-id', checkoutId)
        setLocalStorageCheckoutId(checkoutId)
        queryClient.setQueryData(getQueryKey(checkoutId), checkout)
      }
      return checkout
    }
  })

  const { mutateAsync: onAddLineItem } = useMutation({
    mutationFn: async ({
      variantId,
      quantity
    }: {
      variantId: string
      quantity: number
    }) => {
      const res = await fetch(`/api/checkout/${localStorageCheckoutId}`, {
        method: 'POST',
        body: JSON.stringify({ variantId, quantity }),
        headers: {
          'content-type': 'application/json'
        }
      })
      const { checkout } = await res.json()
      return checkout
    },
    onSuccess: newCheckout => {
      queryClient.setQueryData(queryKey, newCheckout)
    },
    // Always refetch after error or success:
    onSettled: () => {
      queryClient.invalidateQueries(queryKey)
    }
  })

  const { mutateAsync: onUpdateLineItem } = useMutation({
    mutationFn: async ({
      variantId,
      quantity
    }: {
      variantId: string
      quantity: number
    }) => {
      const res = await fetch(`/api/checkout/${localStorageCheckoutId}`, {
        method: 'PUT',
        body: JSON.stringify({ variantId, quantity, putAction: 'update' }),
        headers: {
          'content-type': 'application/json'
        }
      })
      const { checkout } = await res.json()
      return checkout
    },
    onSuccess: newCheckout => {
      queryClient.setQueryData(queryKey, newCheckout)
    },
    // Always refetch after error or success:
    onSettled: () => {
      queryClient.invalidateQueries(queryKey)
    }
  })

  const { mutateAsync: onRemoveLineItem } = useMutation({
    mutationFn: async ({ variantId }: { variantId: string }) => {
      const res = await fetch(`/api/checkout/${localStorageCheckoutId}`, {
        method: 'PUT',
        body: JSON.stringify({ variantId, putAction: 'remove' }),
        headers: {
          'content-type': 'application/json'
        }
      })
      const { checkout } = await res.json()
      return checkout
    },
    onSuccess: newCheckout => {
      queryClient.setQueryData(queryKey, newCheckout)
    },
    // Always refetch after error or success:
    onSettled: () => {
      queryClient.invalidateQueries(queryKey)
    }
  })

  return (
    <ShopifyContext.Provider
      value={{
        cart,
        cartToggleState,
        onAddLineItem,
        onRemoveLineItem,
        onUpdateLineItem
      }}
    >
      {children}
    </ShopifyContext.Provider>
  )
}

export const useShopify = () => {
  const ctx = React.useContext(ShopifyContext)
  if (ctx === undefined) {
    throw new Error('useShopify must be used below <ShopifyContextProvider />')
  }
  return ctx
}
