async function loadFearGreed() {
    try {
        const res = await fetch('https://api.alternative.me/fng/?limit=1');
        const data = await res.json();
        const value = data.data[0].value;
        const classification = data.data[0].value_classification;
        document.getElementById('fg-index').innerText = `${value} (${classification})`;
    } catch (err) {
        document.getElementById('fg-index').innerText = '載入失敗';
    }
}

async function loadBTCBalance() {
    const address = '1Ay8vMC7R1UbyCCZRVULMV7iQpHSAbguJP';
    try {
        const res = await fetch(`https://api.blockchair.com/bitcoin/dashboards/address/${address}`);
        const data = await res.json();
        const balance = data.data[address].address.balance / 1e8;
        document.getElementById('btc-balance-amount').innerText = `${balance.toFixed(8)} BTC`;

        const txs = data.data[address].transactions;
        const chartData = txs.map(tx => ({
            date: new Date(tx.time * 1000).toLocaleDateString(),
            balance: tx.balance / 1e8
        }));
        chartData.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        const ctx = document.getElementById('btc-balance-chart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.map(d => d.date),
                datasets: [{
                    label: 'BTC Balance',
                    data: chartData.map(d => d.balance),
                    borderColor: 'blue',
                    fill: false
                }]
            }
        });
    } catch (err) {
        document.getElementById('btc-balance-amount').innerText = '載入失敗';
    }
}

loadFearGreed();
loadBTCBalance();
