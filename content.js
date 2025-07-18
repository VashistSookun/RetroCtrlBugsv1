// Amazon Review Analyzer - Content Script
class ReviewAnalyzer {
  constructor() {
    this.reviews = [];
    this.suspiciousCount = 0;
    this.totalReviews = 0;
    this.scanButton = null;
    this.isAnalyzed = false;
    
    this.genericPhrases = [
      "great product", "love it", "amazing", "terrible", "worst ever",
      "highly recommend", "perfect", "awesome", "fantastic", "excellent",
      "bad quality", "don't buy", "waste of money", "poor quality"
    ];
    
    this.init();
  }

  init() {
    if (this.isAmazonProductPage()) {
      this.createScanButton();
      this.observePageChanges();
    }
  }

  isAmazonProductPage() {
    return window.location.href.includes('/dp/') || 
           window.location.href.includes('/product/') ||
           document.querySelector('[data-hook="review-body"]') !== null;
  }

  createScanButton() {
    if (this.scanButton) return;
    
    this.scanButton = document.createElement('div');
    this.scanButton.id = 'review-analyzer-button';
    this.scanButton.innerHTML = `
      <div class="pixel-button">
        ░░░ SCAN REVIEWS ░░░
      </div>
    `;
    
    this.scanButton.addEventListener('click', () => this.analyzeReviews());
    document.body.appendChild(this.scanButton);
  }

  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          const hasReviews = Array.from(mutation.addedNodes).some(node => 
            node.nodeType === 1 && node.querySelector && 
            node.querySelector('[data-hook="review-body"]')
          );
          if (hasReviews && !this.isAnalyzed) {
            setTimeout(() => this.analyzeReviews(), 1000);
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  analyzeReviews() {
    try {
      this.reviews = [];
      this.suspiciousCount = 0;
      
      // Multiple selectors to handle different Amazon layouts
      const reviewSelectors = [
        '[data-hook="review-body"] span',
        '.review-text',
        '.cr-original-review-text',
        '[data-hook="review-body"]'
      ];
      
      let reviewElements = [];
      for (const selector of reviewSelectors) {
        reviewElements = document.querySelectorAll(selector);
        if (reviewElements.length > 0) break;
      }

      if (reviewElements.length === 0) {
        this.showNoReviewsMessage();
        return;
      }

      reviewElements.forEach((element, index) => {
        const reviewData = this.extractReviewData(element, index);
        if (reviewData) {
          this.reviews.push(reviewData);
        }
      });

      this.totalReviews = this.reviews.length;
      this.highlightReviews();
      this.saveResults();
      this.updateButton();
      this.isAnalyzed = true;

    } catch (error) {
      console.error('Review analysis error:', error);
    }
  }

  extractReviewData(element, index) {
    try {
      const reviewContainer = element.closest('[data-hook="review"]') || 
                            element.closest('.review') ||
                            element.closest('.a-section');
      
      if (!reviewContainer) return null;

      const text = element.textContent?.trim() || '';
      if (text.length === 0) return null;

      // Extract rating
      let rating = 5; // default
      const ratingElement = reviewContainer.querySelector('.a-icon-alt, [data-hook="review-star-rating"] .a-icon-alt, .review-rating .a-icon-alt');
      if (ratingElement) {
        const ratingText = ratingElement.textContent || '';
        const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
        if (ratingMatch) {
          rating = parseFloat(ratingMatch[1]);
        }
      }

      // Extract date (optional)
      const dateElement = reviewContainer.querySelector('[data-hook="review-date"], .review-date');
      const date = dateElement ? dateElement.textContent.trim() : '';

      const review = {
        id: index,
        text: text,
        rating: rating,
        date: date,
        element: reviewContainer,
        isSuspicious: this.isSuspicious(text, rating)
      };

      if (review.isSuspicious) {
        this.suspiciousCount++;
      }

      return review;
    } catch (error) {
      console.error('Error extracting review data:', error);
      return null;
    }
  }

  isSuspicious(text, rating) {
    const wordCount = text.trim().split(/\s+/).length;
    const capsCount = (text.match(/[A-Z]/g) || []).length;
    const capsPercentage = capsCount / text.length;
  
    const hasGenericPhrase = this.genericPhrases.some(phrase =>
      text.toLowerCase().includes(phrase.toLowerCase())
    );
  
    // Define individual suspicion indicators
    const tooShort = wordCount < 8;
    const tooManyCaps = capsPercentage > 0.25 && text.length > 30;
    const overlyPositive = rating >= 4.8 && hasGenericPhrase;
  
    // Add up how many signals are triggered
    const suspiciousScore = [tooShort, tooManyCaps, overlyPositive].filter(Boolean).length;
  
    // Mark as suspicious if any 2 OR if a single strong signal (e.g., generic phrase + high rating)
    return suspiciousScore >= 2 || (hasGenericPhrase && rating >= 4.9);
  }
  
  
  /*
  isSuspicious(text, rating) {
    const wordCount = text.split(/\s+/).length;
    const capsPercentage = (text.match(/[A-Z]/g) || []).length / text.length;
    const hasGenericPhrase = this.genericPhrases.some(phrase => 
      text.toLowerCase().includes(phrase.toLowerCase())
    );

    return (
      wordCount < 10 ||
      capsPercentage > 0.5 ||
      hasGenericPhrase ||
      (rating === 5 && wordCount < 15)
    );
  }
  */

  highlightReviews() {
    this.reviews.forEach(review => {
      if (review.element) {
        review.element.classList.remove('review-good', 'review-suspicious');
        review.element.classList.add(review.isSuspicious ? 'review-suspicious' : 'review-good');
      }
    });
  }

  saveResults() {
    const goodReviews = this.reviews.filter(r => !r.isSuspicious);
    const badReviews = this.reviews.filter(r => !r.isSuspicious);
    
    const bestReviews = goodReviews
      .filter(r => r.rating >= 4)
      .sort((a, b) => b.text.length - a.text.length)
      .slice(0, 5);
    
    const worstReviews = badReviews
      .filter(r => r.rating <= 2)
      .sort((a, b) => b.text.length - a.text.length)
      .slice(0, 5);

    const recommendation = this.totalReviews > 0 ? 
      Math.round((goodReviews.length / this.totalReviews) * 100) : 0;

    const results = {
      totalReviews: this.totalReviews,
      suspiciousCount: this.suspiciousCount,
      recommendation: recommendation,
      bestReviews: bestReviews.map(r => ({
        rating: r.rating,
        text: r.text.substring(0, 100) + (r.text.length > 100 ? '...' : ''),
        fullText: r.text
      })),
      worstReviews: worstReviews.map(r => ({
        rating: r.rating,
        text: r.text.substring(0, 100) + (r.text.length > 100 ? '...' : ''),
        fullText: r.text
      })),
      timestamp: Date.now()
    };

    chrome.storage.local.set({ reviewAnalysis: results });
  }

  updateButton() {
    if (this.scanButton) {
      this.scanButton.innerHTML = `
        <div class="pixel-button analyzed">
          ▓▓▓ ANALYZED ▓▓▓<br>
          <small>${this.suspiciousCount}/${this.totalReviews} suspicious</small>
        </div>
      `;
    }
  }

  showNoReviewsMessage() {
    if (this.scanButton) {
      this.scanButton.innerHTML = `
        <div class="pixel-button error">
          ░░░ NO REVIEWS ░░░
        </div>
      `;
    }
  }
}

// Initialize the analyzer when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ReviewAnalyzer();
  });
} else {
  new ReviewAnalyzer();
}

// Handle dynamic page changes (SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(() => {
      const existingButton = document.getElementById('review-analyzer-button');
      if (existingButton) {
        existingButton.remove();
      }
      new ReviewAnalyzer();
    }, 2000);
  }
}).observe(document, { subtree: true, childList: true });