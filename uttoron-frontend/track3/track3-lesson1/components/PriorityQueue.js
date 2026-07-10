class PriorityQueue {
    constructor(items = []) {
        this.items = items.map((item, index) => ({
            ...item,
            index: index,
            priority: item.priority || 0
        }));
        this.sort();
    }

    sort() {
        const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
        this.items.sort((a, b) => {
            const aPriority = priorityOrder[a.severity] !== undefined ? priorityOrder[a.severity] : 999;
            const bPriority = priorityOrder[b.severity] !== undefined ? priorityOrder[b.severity] : 999;
            return aPriority - bPriority;
        });
    }

    enqueue(item) {
        this.items.push(item);
        this.sort();
    }

    dequeue() {
        return this.items.shift();
    }

    peek() {
        return this.items[0];
    }

    getItems() {
        return this.items;
    }

    reorder(newOrder) {
        // newOrder is an array of item IDs in the new order
        const itemMap = new Map(this.items.map(item => [item.id, item]));
        this.items = newOrder.map(id => itemMap.get(id)).filter(item => item !== undefined);
    }

    checkOrder() {
        const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
        for (let i = 0; i < this.items.length - 1; i++) {
            const currentPriority = priorityOrder[this.items[i].severity];
            const nextPriority = priorityOrder[this.items[i + 1].severity];
            if (currentPriority > nextPriority) {
                return false;
            }
        }
        return true;
    }

    isEmpty() {
        return this.items.length === 0;
    }

    size() {
        return this.items.length;
    }
}

export { PriorityQueue };
