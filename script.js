
/**
 * Matches customer cart / list schema:
 * { event_type: "Product List Viewed",
 *   event_properties: { list_name: "men-shoes",
 *     products: [ { sku: "IE3437", position: 1 }, { sku: "HQ4199", position: 2 } ] } }
 *
 * Split parent property `products` in Amplitude, then lookup-map child `sku`.
 * https://amplitude.com/docs/analytics/charts/cart-analysis
 */

const CATALOG = [
    { sku: 'IE3437', name: 'Ultrapace Runner', list_name: 'men-shoes', category: 'footwear', color: 'core black', price: 180 },
    { sku: 'HQ4199', name: 'Samba Indoor', list_name: 'men-shoes', category: 'footwear', color: 'cloud white', price: 110 },
    { sku: 'IF5632', name: 'Pitch Control Boot', list_name: 'men-shoes', category: 'footwear', color: 'navy', price: 220 },
    { sku: 'IE3411', name: 'Ultrapace Runner W', list_name: 'women-shoes', category: 'footwear', color: 'core black', price: 180 },
    { sku: 'HQ4201', name: 'Gazelle Indoor W', list_name: 'women-shoes', category: 'footwear', color: 'pink', price: 110 },
    { sku: 'IM7788', name: 'Track Hoodie', list_name: 'apparel', category: 'apparel', color: 'core black', price: 90 },
    { sku: 'IM7789', name: 'Club Tee', list_name: 'apparel', category: 'apparel', color: 'cloud white', price: 35 },
];

const CART_KEY = 'apexCart';
let currentList = 'men-shoes';

function productsForList(listName) {
    return CATALOG.filter((item) => item.list_name === listName);
}

/** Customer list payload: sku + 1-based position only */
function listViewedProducts(listName) {
    return productsForList(listName).map((item, index) => ({
        sku: item.sku,
        position: index + 1,
    }));
}

function trackProductListViewed(listName) {
    track('Product List Viewed', {
        list_name: listName,
        products: listViewedProducts(listName),
    });
}

function getCart() {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
}

function setCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    renderCart();
}

function cartTotal(items) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function money(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function track(eventName, properties) {
    if (typeof amplitude === 'undefined') {
        console.log('Amplitude not loaded:', eventName, properties);
        return;
    }
    amplitude.track(eventName, properties);
    console.log('Amplitude', eventName, JSON.stringify({ event_type: eventName, event_properties: properties }, null, 2));
}

function renderProducts(listName) {
    currentList = listName;
    const products = productsForList(listName);
    const grid = document.getElementById('productGrid');
    grid.innerHTML = products.map((product, index) => `
        <article class="product-card" onclick="viewProduct('${product.sku}')">
            <div class="product-visual ${product.category}"></div>
            <div class="product-info">
                <div class="sku">${product.sku} · pos ${index + 1}</div>
                <h3>${product.name}</h3>
                <div class="category">${product.list_name} · ${product.color}</div>
                <div class="price">${money(product.price)}</div>
            </div>
        </article>
    `).join('');

    document.querySelectorAll('.list-tab').forEach((tab) => {
        tab.classList.toggle('is-active', tab.dataset.list === listName);
    });
}

function viewProduct(sku) {
    const product = CATALOG.find((item) => item.sku === sku);
    if (!product) return;
    const position = productsForList(product.list_name).findIndex((item) => item.sku === sku) + 1;

    track('Product Viewed', {
        list_name: product.list_name,
        products: [{ sku: product.sku, position: position }],
    });

    document.getElementById('modalContent').innerHTML = `
        <p class="sku">${product.sku} · ${product.list_name} · position ${position}</p>
        <h2>${product.name}</h2>
        <p class="category">${product.color}</p>
        <p class="price">${money(product.price)}</p>
        <div class="modal-actions">
            <button type="button" class="btn" onclick="addToCart('${product.sku}')">Product Added to Cart</button>
        </div>
    `;
    document.getElementById('productModal').classList.add('open');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('open');
}

function addToCart(sku) {
    const product = CATALOG.find((item) => item.sku === sku);
    const position = productsForList(product.list_name).findIndex((item) => item.sku === sku) + 1;
    const cart = getCart();
    const existing = cart.find((item) => item.sku === sku);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    setCart(cart);

    track('Product Added to Cart', {
        list_name: product.list_name,
        products: [{ sku: product.sku, position: position }],
    });

    closeProductModal();
    openCart();
}

function checkout() {
    const cart = getCart();
    if (!cart.length) {
        alert('Your bag is empty.');
        return;
    }

    const products = cart.map((item, index) => ({
        sku: item.sku,
        position: index + 1,
    }));
    const revenue = cartTotal(cart);

    track('Purchase Completed', {
        products: products,
        $revenue: revenue,
        $price: revenue,
        $currency: 'USD',
        item_count: cart.reduce((sum, item) => sum + item.quantity, 0),
    });

    alert('Purchase completed.');
    setCart([]);
    closeCart();
}

function clearCart() {
    setCart([]);
}

function renderCart() {
    const cart = getCart();
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = count;

    const list = document.getElementById('cartItems');
    if (!cart.length) {
        list.innerHTML = '<p class="category">Your bag is empty.</p>';
    } else {
        list.innerHTML = cart.map((item) => `
            <div class="cart-line">
                <div>
                    <strong>${item.name}</strong>
                    <div class="sku">${item.sku} · qty ${item.quantity}</div>
                </div>
                <div>${money(item.price * item.quantity)}</div>
            </div>
        `).join('');
    }
    document.getElementById('cartTotal').textContent = money(cartTotal(cart));
}

function toggleCart() {
    const drawer = document.getElementById('cart');
    if (drawer.classList.contains('hidden')) {
        openCart();
    } else {
        closeCart();
    }
}

function openCart() {
    document.getElementById('cart').classList.remove('hidden');
    document.getElementById('cartBackdrop').classList.remove('hidden');
}

function closeCart() {
    document.getElementById('cart').classList.add('hidden');
    document.getElementById('cartBackdrop').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', function () {
    renderProducts('men-shoes');
    trackProductListViewed('men-shoes');
    renderCart();

    document.getElementById('listTabs').addEventListener('click', function (event) {
        const tab = event.target.closest('.list-tab');
        if (!tab) return;
        renderProducts(tab.dataset.list);
        trackProductListViewed(tab.dataset.list);
    });

    window.onclick = function (event) {
        const modal = document.getElementById('productModal');
        if (event.target === modal) {
            closeProductModal();
        }
    };
});
