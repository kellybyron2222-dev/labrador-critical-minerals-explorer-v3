/**
 * Persistent feedback affordance — opens Settings → Feedback.
 */

export default class FeedbackFab {
  /**
   * @param {{ onOpen: () => void }} handlers
   */
  constructor(handlers = {}) {
    this.onOpen = handlers.onOpen || (() => {});
    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = 'feedback-fab';
    this.btn.setAttribute('aria-label', 'Send feedback');
    this.btn.innerHTML = `<span class="feedback-fab-label">Feedback</span>`;
    this.btn.addEventListener('click', () => this.onOpen());
    document.body.appendChild(this.btn);
  }
}
