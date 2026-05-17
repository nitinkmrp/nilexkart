import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';

const ProductCard = ({ product }) => {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8}>
      <View style={styles.imageWrapper}>
        <Image 
          source={{ uri: product.imgUrl || 'https://via.placeholder.com/300' }} 
          style={styles.image} 
          resizeMode="cover"
        />
      </View>
      
      {product.sizes && product.sizes.length > 0 && (
        <View style={styles.sizesContainer}>
          {product.sizes.map((size, index) => (
            <View key={index} style={styles.sizeChip}>
              <Text style={styles.sizeText}>{size}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.title} numberOfLines={1}>
        {product.productName}
      </Text>
      
      <Text style={styles.price}>
        ₹{product.price}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '48%', // Allows 2 columns
    marginBottom: 24,
    backgroundColor: '#fff',
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  sizesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 4,
    gap: 4,
  },
  sizeChip: {
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: '#fff',
  },
  sizeText: {
    fontSize: 10,
    color: '#555',
    fontWeight: '600',
  },
  title: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#000',
  },
  price: {
    marginTop: 2,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});

export default ProductCard;
