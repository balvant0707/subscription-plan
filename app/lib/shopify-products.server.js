export async function fetchProducts(admin) {
  try {
    const response = await admin.graphql(
      `#graphql
        query SubscriptionAppProducts {
          products(first: 50) {
            nodes {
              id
              title
              variants(first: 1) {
                nodes {
                  price
                }
              }
            }
          }
        }`,
    );

    const json = await response.json();
    const nodes = json?.data?.products?.nodes ?? [];

    return nodes.map((product) => {
      const firstVariant = product.variants?.nodes?.[0];
      return {
        id: product.id,
        title: product.title,
        price: firstVariant?.price ? Number.parseFloat(firstVariant.price) : 0,
      };
    });
  } catch (error) {
    return [];
  }
}

