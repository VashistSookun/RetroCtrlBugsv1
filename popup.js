// Amazon Review Analyzer - Popup Script
class PopupController {
  constructor() {
    this.contentElement = document.getElementById('content');
    this.loadData();
  }

  async loadData() {
    try {
      const result = await chrome.storage.local.get(['reviewAnalysis']);
      const data = result.reviewAnalysis;
      
      if (data && data.timestamp) {
        this.renderAnalysis(data);
      } else {
        this.renderNoData();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.renderError();
    }
  }

  renderAnalysis(data) {
    const progressBar = this.createProgressBar(data.recommendation);
    const recommendationColor = this.getRecommendationColor(data.recommendation);
    
    this.contentElement.innerHTML = `
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-number">${data.totalReviews}</div>
          <div class="stat-label">TOTAL REVIEWS</div>
        </div>
        <div class="stat-box">
          <div class="stat-number" style="color: #ff0000;">${data.suspiciousCount}</div>
          <div class="stat-label">SUSPICIOUS</div>
        </div>
      </div>
      
      <div class="recommendation">
        <div class="recommendation-score" style="color: ${recommendationColor};">
          ${data.recommendation}% TRUSTED
        </div>
        <div class="progress-bar">${progressBar}</div>
        <div style="font-size: 10px; margin-top: 4px;">
          ${this.getRecommendationText(data.recommendation)}
        </div>
      </div>
      
      <div class="divider">░░░░░░░░░░░░░░░░░░░░░░░░░</div>
      
      ${this.renderBestReviews(data.bestReviews)}
      
      <div class="divider">▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓</div>
      
      ${this.renderWorstReviews(data.worstReviews)}
      
      <div class="divider">═══════════════════════════</div>
      
      <div style="text-align: center; font-size: 10px; color: #00ffff; margin-top: 8px;">
        ANALYSIS COMPLETE • ${new Date(data.timestamp).toLocaleTimeString()}
      </div>
    `;
  }

  renderBestReviews(reviews) {
    if (!reviews || reviews.length === 0) {
      return `
        <div class="section">
          <div class="section-header">
            ░░░ BEST REAL REVIEWS ░░░
          </div>
          <div style="text-align: center; color: #ff0000; padding: 16px;">
            NO QUALITY REVIEWS FOUND
          </div>
        </div>
      `;
    }

    return `
      <div class="section">
        <div class="section-header">
          ░░░ BEST REAL REVIEWS ░░░
        </div>
        ${reviews.map((review, index) => this.renderReviewItem(review, index, 'best')).join('')}
      </div>
    `;
  }

  renderWorstReviews(reviews) {
    if (!reviews || reviews.length === 0) {
      return `
        <div class="section">
          <div class="section-header" style="background: #ff0000;">
            ░░░ WORST REAL REVIEWS ░░░
          </div>
          <div style="text-align: center; color: #ff0000; padding: 16px;">
            NO CRITICAL REVIEWS FOUND
          </div>
        </div>
      `;
    }

    return `
      <div class="section">
        <div class="section-header" style="background: #ff0000;">
          ░░░ WORST REAL REVIEWS ░░░
        </div>
        ${reviews.map((review, index) => this.renderReviewItem(review, index, 'worst')).join('')}
      </div>
    `;
  }

  renderReviewItem(review, index, type) {
    const stars = '★'.repeat(Math.floor(review.rating)) + '☆'.repeat(5 - Math.floor(review.rating));
    const hasMore = review.text.length < review.fullText.length;
    
    return `
      <div class="review-item">
        <div class="review-rating">
          ${stars} (${review.rating}/5)
        </div>
        <div class="review-text">${review.text}</div>
        ${hasMore ? `<button class="read-full-btn" onclick="showFullReview('${type}', ${index})">READ FULL</button>` : ''}
      </div>
    `;
  }

  createProgressBar(percentage) {
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }

  getRecommendationColor(percentage) {
    if (percentage >= 70) return '#00ff00';
    if (percentage >= 40) return '#ffff00';
    return '#ff0000';
  }

  getRecommendationText(percentage) {
    if (percentage >= 80) return '▓▓▓ HIGHLY TRUSTED ▓▓▓';
    if (percentage >= 60) return '░░░ MODERATELY TRUSTED ░░░';
    if (percentage >= 40) return '▒▒▒ SOMEWHAT SUSPICIOUS ▒▒▒';
    return '███ HIGHLY SUSPICIOUS ███';
  }

  renderNoData() {
    this.contentElement.innerHTML = `
      <div class="no-data">
        <div>▓▓▓ NO ANALYSIS DATA ▓▓▓</div>
        <div style="margin-top: 8px; font-size: 10px;">
          Visit an Amazon product page<br>
          and click "SCAN REVIEWS"
        </div>
      </div>
    `;
  }

  renderError() {
    this.contentElement.innerHTML = `
      <div class="no-data">
        <div style="color: #ff0000;">░░░ ERROR LOADING DATA ░░░</div>
        <div style="margin-top: 8px; font-size: 10px;">
          Please try refreshing the page
        </div>
      </div>
    `;
  }
}

// Global function to show full review text
window.showFullReview = async function(type, index) {
  try {
    const result = await chrome.storage.local.get(['reviewAnalysis']);
    const data = result.reviewAnalysis;
    
    if (!data) return;
    
    const reviews = type === 'best' ? data.bestReviews : data.worstReviews;
    const review = reviews[index];
    
    if (review && review.fullText) {
      // Create modal overlay
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      `;
      
      const stars = '★'.repeat(Math.floor(review.rating)) + '☆'.repeat(5 - Math.floor(review.rating));
      
      modal.innerHTML = `
        <div style="
          background: #000000;
          border: 4px solid #00ff00;
          padding: 16px;
          max-width: 90%;
          max-height: 80%;
          overflow-y: auto;
          font-family: 'Courier New', monospace;
          color: #ffffff;
        ">
          <div style="
            color: #ffff00;
            font-weight: bold;
            margin-bottom: 8px;
            text-align: center;
            background: #00ff00;
            color: #000000;
            padding: 4px;
          ">
            ═══ FULL REVIEW ═══
          </div>
          
          <div style="color: #ffff00; margin-bottom: 8px;">
            ${stars} (${review.rating}/5)
          </div>
          
          <div style="line-height: 1.4; margin-bottom: 16px;">
            ${review.fullText}
          </div>
          
          <div style="text-align: center;">
            <button onclick="this.closest('div').parentElement.remove()" style="
              background: #ff0000;
              color: #ffffff;
              border: 2px solid #ff0000;
              padding: 8px 16px;
              font-family: 'Courier New', monospace;
              cursor: pointer;
            ">
              ░░░ CLOSE ░░░
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Close on click outside
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    }
  } catch (error) {
    console.error('Error showing full review:', error);
  }
};

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});