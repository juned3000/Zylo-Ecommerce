/**
 * Rating System - Modern Interactive Star Rating Component
 * Features: Interactive stars, hover effects, animations, responsive design
 */

class RatingSystem {
    constructor() {
        this.generatedRatings = new Map(); // Cache for generated ratings to maintain consistency
        this.init();
    }

    init() {
        this.createDefaultRatings();
        this.initializeEventListeners();
    }

    /**
     * Create a star rating display
     * @param {number} rating - Rating value (0-5)
     * @param {number} totalRatings - Total number of ratings
     * @param {string} size - Size variant (small, normal, large, extra-large)
     * @param {boolean} showText - Whether to show rating text
     * @param {boolean} interactive - Whether stars are clickable
     */
    createStarRating(rating = 0, totalRatings = 0, size = 'normal', showText = true, interactive = false) {
        const ratingValue = Math.max(0, Math.min(5, rating)); // Clamp between 0-5
        const fullStars = Math.floor(ratingValue);
        const hasHalfStar = ratingValue % 1 !== 0;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        let sizeClass = '';
        switch (size) {
            case 'small': sizeClass = 'small'; break;
            case 'large': sizeClass = 'large'; break;
            case 'extra-large': sizeClass = 'extra-large'; break;
            default: sizeClass = ''; break;
        }

        let html = `<div class="rating-container">`;
        html += `<div class="star-rating ${sizeClass} ${interactive ? 'interactive' : ''}" data-rating="${ratingValue}">`;

        // Full stars
        for (let i = 0; i < fullStars; i++) {
            html += `<i class="fas fa-star star filled" data-rating="${i + 1}"></i>`;
        }

        // Half star
        if (hasHalfStar) {
            html += `<i class="fas fa-star star half-filled" data-rating="${fullStars + 1}"></i>`;
        }

        // Empty stars
        for (let i = 0; i < emptyStars; i++) {
            html += `<i class="far fa-star star" data-rating="${fullStars + (hasHalfStar ? 1 : 0) + i + 1}"></i>`;
        }

        html += `</div>`;

        if (showText) {
            const textClass = size === 'large' || size === 'extra-large' ? 'large' : '';
            html += `<span class="rating-text ${textClass}">`;
            if (rating > 0) {
                html += `${rating.toFixed(1)}`;
            } else {
                html += `<span class="rating-count">No ratings yet</span>`;
            }
            html += `</span>`;
        }

        html += `</div>`;
        return html;
    }

    /**
     * Create detailed rating breakdown
     * @param {Object} ratingData - Rating data with distribution
     */
    createRatingBreakdown(ratingData) {
        const { averageRating, totalRatings, ratingDistribution } = ratingData;
        
        let html = `<div class="rating-breakdown">`;
        html += `<h3 class="rating-breakdown-title">Customer Reviews</h3>`;
        html += `<div class="rating-overview">`;
        
        // Rating summary
        html += `<div class="rating-summary">`;
        html += `<div class="rating-average">${averageRating.toFixed(1)}</div>`;
        html += `<div class="rating-stars-large">`;
        html += this.createStarRating(averageRating, 0, 'large', false);
        html += `</div>`;
        html += `<div class="rating-total">${totalRatings} ${totalRatings === 1 ? 'review' : 'reviews'}</div>`;
        html += `</div>`;
        
        // Rating bars
        html += `<div class="rating-bars">`;
        for (let i = 5; i >= 1; i--) {
            const count = ratingDistribution[i] || 0;
            const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
            
            html += `<div class="rating-bar">`;
            html += `<div class="rating-bar-label">${i}</div>`;
            html += `<i class="fas fa-star star filled" style="font-size: 12px;"></i>`;
            html += `<div class="rating-bar-fill">`;
            html += `<div class="rating-bar-progress" style="width: ${percentage}%"></div>`;
            html += `</div>`;
            html += `<div class="rating-bar-count">${count}</div>`;
            html += `</div>`;
        }
        html += `</div>`;
        
        html += `</div>`;
        html += `</div>`;
        
        return html;
    }

    /**
     * Create rating input form
     * @param {string} productId - Product ID
     * @param {Function} onSubmit - Callback function when rating is submitted
     */
    createRatingInput(productId, onSubmit) {
        const html = `
            <div class="rating-input-form" id="rating-form-${productId}">
                <h3 class="rating-input-title">Rate this product</h3>
                <div class="rating-input-stars" data-product-id="${productId}">
                    <i class="far fa-star star" data-rating="1"></i>
                    <i class="far fa-star star" data-rating="2"></i>
                    <i class="far fa-star star" data-rating="3"></i>
                    <i class="far fa-star star" data-rating="4"></i>
                    <i class="far fa-star star" data-rating="5"></i>
                </div>
                <textarea 
                    class="rating-input-review" 
                    placeholder="Share your experience with this product (optional)..."
                    id="review-text-${productId}"
                ></textarea>
                <button 
                    class="rating-submit-btn" 
                    id="submit-rating-${productId}"
                    onclick="window.RatingSystem.submitRating('${productId}', ${onSubmit ? 'true' : 'false'})"
                    disabled
                >
                    Submit Review
                </button>
            </div>
        `;
        return html;
    }

    /**
     * Format rating count for display
     * @param {number} count - Number of ratings
     */
    formatRatingCount(count) {
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M`;
        } else if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toString();
    }

    /**
     * Get rating status based on average rating
     * @param {number} rating - Average rating
     */
    getRatingStatus(rating) {
        if (rating >= 4.5) return 'excellent';
        if (rating >= 3.5) return 'good';
        if (rating >= 2.5) return 'average';
        return 'poor';
    }

    /**
     * Initialize event listeners for interactive ratings
     */
    initializeEventListeners() {
        // Handle hover effects for interactive ratings
        document.addEventListener('mouseover', (e) => {
            if (e.target.classList.contains('star') && e.target.closest('.star-rating.interactive')) {
                this.handleStarHover(e.target);
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.classList.contains('star') && e.target.closest('.star-rating.interactive')) {
                this.handleStarHoverOut(e.target);
            }
        });

        // Handle clicks for rating input
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('star') && e.target.closest('.rating-input-stars')) {
                this.handleRatingInput(e.target);
            }
        });

        // Handle admin rating input
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('star') && e.target.closest('.admin-rating-stars')) {
                this.handleAdminRating(e.target);
            }
        });
    }

    /**
     * Handle star hover for interactive ratings
     */
    handleStarHover(starElement) {
        const ratingContainer = starElement.closest('.star-rating');
        const stars = ratingContainer.querySelectorAll('.star');
        const rating = parseInt(starElement.dataset.rating);

        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('hovered');
            } else {
                star.classList.remove('hovered');
            }
        });
    }

    /**
     * Handle star hover out for interactive ratings
     */
    handleStarHoverOut(starElement) {
        const ratingContainer = starElement.closest('.star-rating');
        const stars = ratingContainer.querySelectorAll('.star');
        
        stars.forEach(star => {
            star.classList.remove('hovered');
        });
    }

    /**
     * Handle rating input selection
     */
    handleRatingInput(starElement) {
        const container = starElement.closest('.rating-input-stars');
        const stars = container.querySelectorAll('.star');
        const rating = parseInt(starElement.dataset.rating);
        const productId = container.dataset.productId;

        // Update star display
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.remove('far');
                star.classList.add('fas', 'active');
            } else {
                star.classList.remove('fas', 'active');
                star.classList.add('far');
            }
        });

        // Store selected rating
        container.dataset.selectedRating = rating;
        
        // Enable submit button
        const submitBtn = document.getElementById(`submit-rating-${productId}`);
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }

    /**
     * Handle admin rating input
     */
    handleAdminRating(starElement) {
        const container = starElement.closest('.admin-rating-stars');
        const stars = container.querySelectorAll('.star');
        const rating = parseInt(starElement.dataset.rating);

        // Update star display
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });

        // Update hidden input if exists
        const hiddenInput = container.parentElement.querySelector('input[type="hidden"]');
        if (hiddenInput) {
            hiddenInput.value = rating;
        }

        // Dispatch custom event
        container.dispatchEvent(new CustomEvent('ratingChanged', { 
            detail: { rating } 
        }));
    }

    /**
     * Submit rating for a product
     * @param {string} productId - Product ID
     * @param {boolean} hasCallback - Whether there's a callback function
     */
    async submitRating(productId, hasCallback = false) {
        const container = document.querySelector(`.rating-input-stars[data-product-id="${productId}"]`);
        const reviewText = document.getElementById(`review-text-${productId}`);
        const submitBtn = document.getElementById(`submit-rating-${productId}`);
        
        if (!container || !container.dataset.selectedRating) {
            alert('Please select a rating before submitting.');
            return;
        }

        const rating = parseInt(container.dataset.selectedRating);
        const reviewComment = reviewText ? reviewText.value.trim() : '';

        // Validate review content
        if (!reviewComment || reviewComment.length < 10) {
            alert('Please write a review with at least 10 characters.');
            return;
        }

        // Disable submit button
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        try {
            // Check if API is available and user is authenticated
            if (typeof window.API === 'undefined') {
                alert('API not available. Please refresh the page.');
                this.resetSubmitButton(submitBtn);
                return;
            }
            
            if (!window.API.isAuthenticated()) {
                alert('Please login to submit a review.');
                this.resetSubmitButton(submitBtn);
                return;
            }
            
            console.log('Submitting review with API system');
            console.log('Review data:', {
                productId: productId,
                rating: rating,
                title: this.generateReviewTitle(rating),
                comment: reviewComment
            });
            
            // Use the same API system as account page
            const response = await window.API.endpoints.reviews.submit({
                productId: productId,
                rating: rating,
                title: this.generateReviewTitle(rating),
                comment: reviewComment,
                orderId: 'demo_order_' + Date.now() // In real app, this should be actual order ID
            });
            
            console.log('Review API response:', response);

            if (response.success) {
                // Show success message
                this.showRatingSuccess(productId);
                
                // Update product ratings display if needed
                this.updateProductRating(productId, rating);
                
                console.log('Review submitted successfully:', response);
                
                // Show success toast if available
                if (window.API?.showSuccess) {
                    window.API.showSuccess(response.message || 'Review submitted successfully!');
                }
            } else {
                // Handle specific validation errors
                if (response.errors && Array.isArray(response.errors)) {
                    const errorMessages = response.errors.map(err => err.msg || err.message).join(', ');
                    throw new Error(`Validation failed: ${errorMessages}`);
                } else {
                    throw new Error(response.message || 'Failed to submit review');
                }
            }
            
        } catch (error) {
            console.error('Error submitting rating:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                response: error.response
            });
            
            let errorMessage = 'Failed to submit review. Please try again.';
            if (error.message.includes('token') || error.message.includes('auth')) {
                errorMessage = 'Please login to submit a review.';
            } else if (error.message.includes('order')) {
                errorMessage = 'You can only review products you have purchased.';
            } else if (error.message.includes('Connection failed')) {
                errorMessage = 'Unable to connect to server. Please check if the backend is running.';
            } else if (error.message.includes('NetworkError')) {
                errorMessage = 'Network error. Please check your internet connection.';
            }
            
            // Use API error display if available, otherwise fallback to alert
            if (window.API?.showError) {
                window.API.showError(errorMessage + ': ' + error.message);
            } else {
                alert(errorMessage + '\n\nTechnical details: ' + error.message);
            }
            
            this.resetSubmitButton(submitBtn);
        }
    }

    /**
     * Reset submit button state
     */
    resetSubmitButton(submitBtn) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Review';
        }
    }

    /**
     * Generate a review title based on rating
     */
    generateReviewTitle(rating) {
        const titles = {
            1: 'Not satisfied',
            2: 'Could be better', 
            3: 'Average product',
            4: 'Good product',
            5: 'Excellent product'
        };
        return titles[rating] || 'Product review';
    }

    /**
     * Simulate rating submission (replace with actual API call)
     */
    async simulateRatingSubmission(productId, rating, review) {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`Rating submitted for product ${productId}: ${rating} stars, review: "${review}"`);
                resolve();
            }, 1000);
        });
    }

    /**
     * Show success message after rating submission
     */
    showRatingSuccess(productId) {
        const form = document.getElementById(`rating-form-${productId}`);
        if (form) {
            form.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-check-circle" style="color: #28a745; font-size: 24px; margin-bottom: 10px;"></i>
                    <h3 style="color: #28a745; margin-bottom: 10px;">Thank you for your review!</h3>
                    <p style="color: #666;">Your rating has been submitted successfully.</p>
                </div>
            `;
        }
    }

    /**
     * Update product rating display after new rating
     */
    updateProductRating(productId, newRating) {
        // This would typically fetch updated rating data from the server
        // For now, we'll just add a visual indicator
        const productElements = document.querySelectorAll(`[data-product-id="${productId}"]`);
        productElements.forEach(element => {
            element.classList.add('rating-fade-in');
        });
    }

    /**
     * Create default ratings for existing products (for demo purposes)
     */
    createDefaultRatings() {
        // Sample rating data for demo
        this.sampleRatings = {
            'f1': { averageRating: 4.5, totalRatings: 128, ratingDistribution: { 1: 2, 2: 5, 3: 15, 4: 34, 5: 72 } },
            'f2': { averageRating: 4.2, totalRatings: 89, ratingDistribution: { 1: 1, 2: 4, 3: 12, 4: 28, 5: 44 } },
            'f3': { averageRating: 4.7, totalRatings: 156, ratingDistribution: { 1: 1, 2: 3, 3: 8, 4: 22, 5: 122 } },
            'f4': { averageRating: 4.1, totalRatings: 73, ratingDistribution: { 1: 2, 2: 5, 3: 10, 4: 28, 5: 28 } },
            'f5': { averageRating: 4.4, totalRatings: 95, ratingDistribution: { 1: 1, 2: 3, 3: 12, 4: 31, 5: 48 } },
            'f6': { averageRating: 4.3, totalRatings: 67, ratingDistribution: { 1: 1, 2: 2, 3: 8, 4: 25, 5: 31 } },
            'f7': { averageRating: 4.8, totalRatings: 203, ratingDistribution: { 1: 0, 2: 2, 3: 6, 4: 25, 5: 170 } },
            'f8': { averageRating: 4.0, totalRatings: 54, ratingDistribution: { 1: 2, 2: 4, 3: 11, 4: 19, 5: 18 } },
            'f9': { averageRating: 4.6, totalRatings: 134, ratingDistribution: { 1: 1, 2: 2, 3: 7, 4: 32, 5: 92 } },
            'f10': { averageRating: 4.2, totalRatings: 88, ratingDistribution: { 1: 2, 2: 3, 3: 11, 4: 30, 5: 42 } },
            'n1': { averageRating: 4.3, totalRatings: 76, ratingDistribution: { 1: 1, 2: 3, 3: 9, 4: 28, 5: 35 } },
            'n2': { averageRating: 4.1, totalRatings: 62, ratingDistribution: { 1: 2, 2: 4, 3: 8, 4: 24, 5: 24 } },
            'n3': { averageRating: 4.5, totalRatings: 97, ratingDistribution: { 1: 1, 2: 2, 3: 7, 4: 29, 5: 58 } },
            'n4': { averageRating: 4.4, totalRatings: 83, ratingDistribution: { 1: 1, 2: 3, 3: 8, 4: 27, 5: 44 } },
            'n5': { averageRating: 4.6, totalRatings: 119, ratingDistribution: { 1: 1, 2: 2, 3: 6, 4: 28, 5: 82 } },
            'n6': { averageRating: 3.9, totalRatings: 45, ratingDistribution: { 1: 3, 2: 4, 3: 8, 4: 18, 5: 12 } },
            'n7': { averageRating: 4.7, totalRatings: 142, ratingDistribution: { 1: 1, 2: 2, 3: 5, 4: 22, 5: 112 } },
            'n8': { averageRating: 4.2, totalRatings: 71, ratingDistribution: { 1: 2, 2: 3, 3: 9, 4: 26, 5: 31 } },
            'n9': { averageRating: 4.8, totalRatings: 167, ratingDistribution: { 1: 0, 2: 1, 3: 4, 4: 28, 5: 134 } },
            'n10': { averageRating: 4.3, totalRatings: 91, ratingDistribution: { 1: 2, 2: 3, 3: 8, 4: 32, 5: 46 } }
        };
    }

    /**
     * Get rating data for a product - now uses database data first
     * @param {string} productId - Product ID
     */
    getSampleRating(productId) {
        if (!productId) {
            return { 
                averageRating: 0, 
                totalRatings: 0, 
                ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } 
            };
        }

        // First, try to get rating data from the loaded product (from database)
        if (window.PRODUCTS && Array.isArray(window.PRODUCTS)) {
            const product = window.PRODUCTS.find(p => p.id === productId);
            if (product && product.averageRating !== undefined) {
                // Use actual database rating data if available
                return {
                    averageRating: product.averageRating || 0,
                    totalRatings: product.totalRatings || 0,
                    ratingDistribution: product.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
                };
            }
        }
        
        // Check if it's a known sample product (for backward compatibility)
        if (this.sampleRatings[productId]) {
            return this.sampleRatings[productId];
        }
        
        // For products without database ratings, use cached generated ratings to maintain consistency
        if (this.generatedRatings.has(productId)) {
            return this.generatedRatings.get(productId);
        }
        
        // Generate new rating only once and cache it
        if (productId && !productId.startsWith('temp-')) {
            // Generate realistic rating for demonstration (only once)
            const ratings = [3.8, 4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7];
            const avgRating = ratings[Math.floor(Math.random() * ratings.length)];
            const totalRatings = Math.floor(Math.random() * 50) + 15; // 15-65 reviews
            
            // Generate realistic distribution
            const distribution = this.generateRealisticDistribution(avgRating, totalRatings);
            
            const generatedRating = {
                averageRating: avgRating,
                totalRatings: totalRatings,
                ratingDistribution: distribution
            };
            
            // Cache the generated rating to maintain consistency
            this.generatedRatings.set(productId, generatedRating);
            return generatedRating;
        }
        
        // Default for truly new/unknown products
        return { 
            averageRating: 0, 
            totalRatings: 0, 
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } 
        };
    }
    
    /**
     * Generate realistic rating distribution based on average rating
     * @param {number} avgRating - Average rating
     * @param {number} total - Total number of ratings
     */
    generateRealisticDistribution(avgRating, total) {
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        // Distribute ratings realistically based on average
        for (let i = 0; i < total; i++) {
            let rating;
            if (avgRating >= 4.5) {
                // Excellent products: mostly 5s and 4s
                rating = Math.random() < 0.7 ? 5 : (Math.random() < 0.8 ? 4 : 3);
            } else if (avgRating >= 4.0) {
                // Good products: mix of 4s and 5s, some 3s
                rating = Math.random() < 0.4 ? 5 : (Math.random() < 0.7 ? 4 : 3);
            } else if (avgRating >= 3.5) {
                // Average products: mostly 3s and 4s
                rating = Math.random() < 0.3 ? 4 : (Math.random() < 0.6 ? 3 : (Math.random() < 0.8 ? 2 : 1));
            } else {
                // Poor products: mix of lower ratings
                rating = Math.random() < 0.2 ? 3 : (Math.random() < 0.5 ? 2 : 1);
            }
            distribution[rating]++;
        }
        
        return distribution;
    }
}

// Initialize the rating system
window.RatingSystem = new RatingSystem();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RatingSystem;
}