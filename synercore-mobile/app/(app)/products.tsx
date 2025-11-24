import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { apiService } from '@/services';

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  category: string;
}

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      console.log('📦 Fetching products from API...');

      // Call real API to get products
      const response = await apiService.getProducts({}, 1, 100);
      console.log('✅ Products loaded:', response?.data?.length || 0);

      // Map backend response to Product interface if needed
      const fetchedProducts = (response?.data || []).map((item: any) => ({
        id: item.id,
        name: item.name || item.product_name,
        sku: item.sku,
        quantity: item.quantity || item.quantity_in_stock,
        price: item.price || item.unit_price,
        category: item.category,
      }));

      setProducts(fetchedProducts);
    } catch (error) {
      console.error('❌ Failed to load products:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const ProductCard = ({ product }: { product: Product }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.productInfo}>
          <ThemedText type="subtitle" style={styles.productName}>
            {product.name}
          </ThemedText>
          <ThemedText style={styles.sku}>{product.sku}</ThemedText>
          <ThemedText style={styles.category}>{product.category}</ThemedText>
        </View>
        <View style={styles.priceContainer}>
          <ThemedText style={styles.price}>${product.price.toFixed(2)}</ThemedText>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.quantityBadge}>
          <MaterialIcons name="inventory-2" size={16} color="#2196F3" />
          <ThemedText style={styles.quantity}>{product.quantity} in stock</ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        renderItem={({ item }) => <ProductCard product={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inventory" size={64} color="#ccc" />
            <ThemedText style={styles.emptyText}>No products found</ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    marginBottom: 4,
  },
  sku: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  category: {
    fontSize: 11,
    color: '#999',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2196F3',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  quantityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quantity: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#ccc',
  },
});
