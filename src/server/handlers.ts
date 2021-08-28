import Client from 'shopify-buy'
import { badRequest, internalServerError, success } from '../lib/api-responses'
import { NextApiRequest, NextApiResponse } from 'next'

export const cartHandler = async (
  req: NextApiRequest,
  res: NextApiResponse,
  { id, client }: { id: string; client: Client.Client }
) => {
  try {
    const { variantId, quantity, putAction } = req.body

    if (typeof id !== 'string') {
      return badRequest(res, `Id is a required query parameter.`)
    }

    switch (req.method) {
      case 'GET': {
        let checkout
        try {
          checkout = await client.checkout.fetch(id)
          if (!checkout) checkout = await client.checkout.create()
        } catch (error) {
          checkout = await client.checkout.create()
        }
        success(res, { checkout })
        break
      }
      case 'POST': {
        // Add
        if (typeof variantId !== 'string' || typeof quantity !== 'number') {
          return badRequest(
            res,
            `Some params are missing in the body: ${JSON.stringify(req.body)}.`
          )
        }
        const checkout = await client.checkout.addLineItems(id, [
          { variantId, quantity }
        ])
        success(res, { checkout })
        break
      }
      case 'PUT': {
        // Update & remove
        if (
          typeof variantId !== 'string' ||
          typeof putAction !== 'string' ||
          (putAction === 'update' && typeof quantity !== 'number')
        ) {
          return badRequest(
            res,
            `Some params are missing in the body: ${JSON.stringify(req.body)}.`
          )
        }
        switch (putAction) {
          case 'update': {
            const checkout = await client.checkout.updateLineItems(id, [
              { quantity, id: variantId }
            ])
            success(res, { checkout })
            break
          }
          case 'remove': {
            const checkout = await client.checkout.removeLineItems(id, [
              variantId
            ])
            success(res, { checkout })
            break
          }
          default:
            badRequest(res, `Put action ${putAction} not supported.`)
            break
        }
        break
      }
      default:
        badRequest(res, `Request method ${req.method} not supported.`)
        break
    }
  } catch (error) {
    internalServerError(res, error)
  }
}

export const newCartHandler = async (
  req: NextApiRequest,
  res: NextApiResponse,
  { client }: { client: Client.Client }
) => {
  try {
    switch (req.method) {
      case 'GET': {
        const checkout = await client.checkout.create()
        success(res, { checkout })
        break
      }
      default:
        badRequest(res, `Request method ${req.method} not supported.`)
        break
    }
  } catch (error) {
    internalServerError(res, error)
  }
}
